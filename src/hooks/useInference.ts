import { useEffect, useState, useCallback, useRef } from 'react';
import * as Llama from '@/llm/engine';
import { buildSystemPrompt } from '@/llm/prompt';
import { useChatStore } from '@/state/useChatStore';
import { useProfileStore } from '@/state/useProfileStore';
import { getModelById } from '@/models/registry';
import * as MM from '@/models/ModelManager';
import { RAMInsufficientError } from '@/utils/ramCheck';
import { FileAttachment } from '@/types';
import { extractFromConversation } from '@/secondbrain/MemoryExtractor';
import { ExtractionQueue } from '@/secondbrain/ExtractionQueue';
import { useBrainNotice } from '@/state/useBrainNotice';
import { isBusy } from '@/llm/engine';
import { AppState } from 'react-native';
import { runResearch } from '@/webresearch/ResearchEngine';
import { formatResearchMarkdown } from '@/webresearch/format';

export interface RAMWarning { available: number; required: number; }

const extractionQueue = new ExtractionQueue({
  isBusy,
  extract: async (conversationId) => {
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

export function useInference(modelId: string | undefined) {
  const [loading, setLoading] = useState(false);
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
      await Llama.initLlm(MM.localPath(model), {
        modelSizeGb: model.sizeGb,
        bypassRamCheck: bypassRam.current,
      });
      setLoaded(true);
    } catch (e) {
      if (e instanceof RAMInsufficientError) {
        setRamWarning({ available: e.available, required: e.required });
        return;
      }
      const msg = e instanceof Error ? e.message : 'MODEL_LOAD_FAILED';
      setError(
        msg === 'INSUFFICIENT_RAM' ? 'Not enough memory — try Gemma 4 E2B.'
        : msg === 'MODEL_NOT_FOUND' ? 'Model file missing or incomplete — re-download it in Settings.'
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
    const system = buildSystemPrompt(profile);
    const messages = useChatStore.getState().current?.messages ?? [];
    chat.startAssistant();
    await Llama.generate(
      system,
      messages,
      (token) => useChatStore.getState().appendToken(token),
      () => {
        void useChatStore.getState().finishAssistant().then(queueMemoryExtraction);
      },
      (e) => {
        useChatStore.getState().appendToken(`\n\n_Error: ${e}_`);
        useChatStore.getState().finishAssistant();
      },
    );
  }, [chat, profile]);

  /**
   * Web research mode: search → read sources → grounded, cited answer. Reuses
   * the assistant message bubble — progress updates render in place, then the
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
      const result = await runResearch(
        text,
        (status) => setContent(`_${status}_`),
        history,
        (answer) => setContent(answer),
      );
      setContent(formatResearchMarkdown(result));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'research failed';
      setContent(`_Research error: ${msg}_`);
    } finally {
      await useChatStore.getState().finishAssistant();
    }
  }, [chat]);

  const stop = useCallback(() => { Llama.stop(); }, []);

  const model = modelId ? getModelById(modelId) : undefined;
  const supportsVision = model?.supportsVision ?? false;
  // Vision is built into the LiteRT model — no separate pack, no extra download.
  // Ready once the model is loaded AND the engine actually enabled the vision graph
  // (the load ladder keeps vision even when it has to run text on the CPU).
  const vision = {
    supported: supportsVision,
    ready: supportsVision && loaded && Llama.isVisionEnabled(),
  };

  return { loading, error, ramWarning, loadAnyway, dismissRamWarning, send, research, stop, vision };
}
