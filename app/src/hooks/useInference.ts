import { useEffect, useState, useCallback, useRef } from 'react';
import { buildSystemPrompt } from '@/llm/prompt';
import { useChatStore } from '@/state/useChatStore';
import { useProfileStore } from '@/state/useProfileStore';
import { getModelById } from '@/models/registry';
import { FileAttachment } from '@/types';
import { ExtractionQueue } from '@/secondbrain/ExtractionQueue';
import { useBrainNotice } from '@/state/useBrainNotice';
import { AppState } from 'react-native';
import { formatResearchMarkdown } from '@/webresearch/format';

export interface RAMWarning { available: number; required: number; }

type LlamaModule = typeof import('@/llm/engine');

function getLlama(): LlamaModule {
  return require('@/llm/engine') as LlamaModule;
}

const extractionQueue = new ExtractionQueue({
  isBusy: () => getLlama().isBusy(),
  extract: async (conversationId) => {
    const { extractFromConversation } = require('@/secondbrain/MemoryExtractor') as typeof import('@/secondbrain/MemoryExtractor');
    const convo = useChatStore.getState().current;
    const messages = convo && convo.id === conversationId ? convo.messages : [];
    if (!messages.length) return 0;
    return extractFromConversation(messages, conversationId);
  },
  // Surface a "N saved to your Second Brain" pill whenever a chat yields facts.
  onResult: (_id, count) => useBrainNotice.getState().show(count),
});

function queueMemoryExtraction(): void {
  const convo = useChatStore.getState().current;
  if (!convo) return;
  extractionQueue.markDirty(convo.id);
  // Try to drain immediately so analysis happens right after the reply, not on
  // the next poll tick. Yields to the next chat send if the context is busy.
  extractionQueue.flush();
}

// Sync check so the loading overlay can be the very first paint instead of
// popping in a frame after the chat screen mounts (loading starts as state,
// but the actual load only kicks off inside a useEffect after that first paint).
function needsLoad(modelId: string | undefined): boolean {
  if (!modelId) return false;
  const model = getModelById(modelId);
  if (!model) return false;
  const MM = require('@/models/ModelManager') as typeof import('@/models/ModelManager');
  return getLlama().getLoadedPath() !== MM.localPath(model);
}

export function useInference(modelId: string | undefined) {
  const [loading, setLoading] = useState(() => needsLoad(modelId));
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ramWarning, setRamWarning] = useState<RAMWarning | null>(null);
  const profile = useProfileStore((s) => s.profile);
  const chat = useChatStore();

  // Set true once the user chooses "Load Anyway" for the current model.
  const bypassRam = useRef(false);

  const load = useCallback(async () => {
    const model = modelId ? getModelById(modelId) : undefined;
    if (!model) return;
    setLoading(true);
    setLoaded(false);
    setError(null);
    setRamWarning(null);
    try {
      const Llama = getLlama();
      const MM = require('@/models/ModelManager') as typeof import('@/models/ModelManager');
      await Llama.initLlm(MM.localPath(model), {
        modelSizeGb: model.sizeGb,
        bypassRamCheck: bypassRam.current,
      });
      setLoaded(true);
    } catch (e) {
      if (e instanceof Error && e.name === 'RAMInsufficientError' && 'available' in e && 'required' in e) {
        const ram = e as Error & { available: number; required: number };
        setRamWarning({ available: ram.available, required: ram.required });
        return;
      }
      const msg = e instanceof Error ? e.message : 'MODEL_LOAD_FAILED';
      setError(
        msg === 'INSUFFICIENT_RAM' ? 'Not enough memory; try Gemma 4 E2B.'
        : msg === 'MODEL_NOT_FOUND' ? 'Model file missing or incomplete; re-download it in Settings.'
        // Show the real native reason so failures are diagnosable, not generic.
        : `Couldn't load the model: ${msg}`,
      );
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  // Load the model whenever the chat (model) changes. Reset the bypass per model.
  useEffect(() => {
    bypassRam.current = false;
    let cancelled = false;
    (async () => { if (!cancelled) await load(); })();
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') extractionQueue.flush(); });
    return () => sub.remove();
  }, []);

  const loadAnyway = useCallback(() => {
    bypassRam.current = true;
    setRamWarning(null);
    void load();
  }, [load]);

  const dismissRamWarning = useCallback(() => setRamWarning(null), []);

  const send = useCallback(async (text: string, attachment?: FileAttachment) => {
    await chat.appendUser(text, attachment ? [attachment] : undefined);
    const messages = useChatStore.getState().current?.messages ?? [];
    const { MemoryStore } = require('@/secondbrain/MemoryStore') as typeof import('@/secondbrain/MemoryStore');
    // The first send after a cold start is often what loads this module, so its
    // AsyncStorage rehydration may still be in flight. Wait for it, or recall
    // reads an empty store and Core answers "I have no saved notes".
    await MemoryStore.ensureHydrated();
    const { selectRecall } = require('@/secondbrain/recall') as typeof import('@/secondbrain/recall');
    const recall = selectRecall(messages, {
      entries: MemoryStore.getAllEntries(),
      enabled: MemoryStore.isEnabled(),
      activeModelId: modelId ?? null,
    });
    const system = buildSystemPrompt(profile, {
      modelName: modelId ? getModelById(modelId)?.name : undefined,
      recall,
    });
    // Dev-only proof that Core context actually reached the exact prompt string
    // handed to the active LiteRT session. Stripped from release builds (__DEV__
    // is false there) — never touches production UI. Check via `adb logcat` /
    // the Metro console, filtering on "[CoreDebug]".
    if (__DEV__) {
      console.log('[CoreDebug]', {
        modelId,
        coreHydrated: MemoryStore.hasHydrated(),
        coreEnabled: MemoryStore.isEnabled(),
        storedEntryCount: MemoryStore.getAllEntries().length,
        recallTopicalKeys: recall.topical.map((t) => t.entry.key),
        recallStyleKeys: recall.style.map((e) => e.key),
        profileQuery: recall.profileQuery ?? false,
        systemPromptHasCoreSection: system.includes('Private notes about the user'),
      });
    }
    chat.startAssistant();
    if (recall.topical.length) {
      useChatStore.getState().setAssistantRecall(
        recall.topical.map((t) => ({ key: t.entry.key, why: t.why })),
      );
    }
    const Llama = getLlama();
    await Llama.generate(
      system,
      messages,
      (token) => useChatStore.getState().appendToken(token),
      () => {
        // Auto-name the chat first (context is free right after the reply), then
        // queue best-effort memory extraction.
        void useChatStore.getState().finishAssistant().then(async () => {
          await useChatStore.getState().ensureTitle();
          queueMemoryExtraction();
        });
      },
      (e) => {
        useChatStore.getState().appendToken(`\n\n_Error: ${e}_`);
        useChatStore.getState().finishAssistant();
      },
    );
  }, [chat, profile, modelId]);

  /**
   * Web research mode: search, read sources, then write a grounded answer. Reuses
   * the assistant message bubble; progress updates render in place, then the
   * final markdown (answer + sources) replaces it. Network + parse failures are
   * surfaced as a normal message, never thrown.
   */
  const research = useCallback(async (text: string) => {
    // Capture prior turns BEFORE adding the new query so research can resolve
    // follow-up references and stay on-topic.
    const history = useChatStore.getState().current?.messages ?? [];
    await chat.appendUser(text);
    chat.startAssistant();
    const setContent = useChatStore.getState().setAssistantContent;
    try {
      const { runResearch } = require('@/webresearch/ResearchEngine') as typeof import('@/webresearch/ResearchEngine');
      const result = await runResearch(
        text,
        (status) => setContent(`_${status}_`),
        history,
        (answer) => setContent(answer),
      );
      setContent(formatResearchMarkdown(result));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'research failed';
      setContent(`_Research could not finish. Check the connection and try again._\n\n_${msg}_`);
    } finally {
      await useChatStore.getState().finishAssistant();
    }
  }, [chat]);

  /**
   * Task mode: route the goal in deterministic code first — obvious smalltalk
   * stays ordinary chat, a follow-up on an existing draft becomes one revise
   * call, and only real goals run the Agent Kernel. Prior artifacts from this
   * conversation ride along so nothing is ever recreated, and a declined
   * Research disclosure zeroes web access in code. Failures surface honestly,
   * never as fake success.
   */
  const act = useCallback(async (text: string, opts?: { researchAllowed?: boolean }) => {
    const { routeGoal } = require('@/agent/router') as typeof import('@/agent/router');
    const { loadTask } = require('@/agent/taskStorage') as typeof import('@/agent/taskStorage');
    const { useAgentStore } = require('@/state/useAgentStore') as typeof import('@/state/useAgentStore');

    const messages = useChatStore.getState().current?.messages ?? [];
    const lastTaskId = [...messages].reverse().find((m) => m.agentTaskId)?.agentTaskId;
    const priorTask = lastTaskId ? await loadTask(lastTaskId) : null;
    const priorArtifacts = priorTask?.artifacts ?? [];
    const mode = useAgentStore.getState().mode;

    const route = routeGoal(text, { hasPriorArtifact: priorArtifacts.length > 0 });
    if (route === 'chat') {
      await send(text);
      return;
    }

    await chat.appendUser(text);
    chat.startAssistant();
    const state = useChatStore.getState();
    const attachments = (state.current?.messages ?? [])
      .filter((m) => m.role === 'user')
      .flatMap((m) => m.attachments ?? [])
      .filter((a) => a.extractedText)
      .map((a) => ({ name: a.name, text: a.extractedText! }));
    try {
      const runner = require('@/agent/runner') as typeof import('@/agent/runner');
      const ctx = {
        conversationId: state.current?.id ?? '',
        goal: text,
        mode,
        modelId: modelId ?? null,
        attachments,
        priorArtifacts,
        researchAllowed: opts?.researchAllowed !== false,
      };
      // Strict refinements go through the kernel so the approval matrix stays
      // in charge of every write; otherwise refine is one direct revise call.
      const { task, receipt } = route === 'refine' && mode !== 'strict'
        ? await runner.runRefineTask(ctx, priorArtifacts[priorArtifacts.length - 1])
        : await runner.runAgentTask(ctx);
      const fallback = task.status === 'cancelled' ? '_Stopped._' : '_The task ended without a reply._';
      useChatStore.getState().setAssistantContent(task.finalAnswer || fallback);
      useChatStore.getState().setAssistantAgent(task.id, receipt);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error';
      useChatStore.getState().setAssistantContent(`_The task could not run: ${msg}_`);
    } finally {
      await useChatStore.getState().finishAssistant();
    }
  }, [chat, modelId, send]);

  const stop = useCallback(() => { getLlama().stop(); }, []);

  const model = modelId ? getModelById(modelId) : undefined;
  const supportsVision = model?.supportsVision ?? false;
  // Vision is built into the LiteRT model; no separate pack, no extra download.
  // Ready once the model is loaded AND the engine actually enabled the vision graph
  // (the load ladder keeps vision even when it has to run text on the CPU).
  const vision = {
    supported: supportsVision,
    ready: supportsVision && loaded && getLlama().isVisionEnabled(),
  };

  return { loading, error, ramWarning, loadAnyway, dismissRamWarning, send, research, act, stop, vision };
}
