import { useEffect, useState, useCallback, useRef } from 'react';
import * as Llama from '@/llm/LlamaService';
import { runVisionSelfTest, getVisionStatus } from '@/llm/LlamaService';
import { buildSystemPrompt } from '@/llm/prompt';
import { useChatStore } from '@/state/useChatStore';
import { useProfileStore } from '@/state/useProfileStore';
import { getModelById } from '@/models/registry';
import * as MM from '@/models/ModelManager';
import { RAMInsufficientError } from '@/utils/ramCheck';
import { FileAttachment } from '@/types';
import { extractFromConversation } from '@/secondbrain/MemoryExtractor';
import { ExtractionQueue } from '@/secondbrain/ExtractionQueue';
import { isBusy } from '@/llm/LlamaService';
import { AppState } from 'react-native';
import { runResearch } from '@/webresearch/ResearchEngine';
import { formatResearchMarkdown } from '@/webresearch/format';
import { deriveVisionStatus } from '@/llm/visionStatus';

export interface RAMWarning { available: number; required: number; }

const extractionQueue = new ExtractionQueue({
  isBusy,
  extract: async (conversationId) => {
    const convo = useChatStore.getState().current;
    const messages = convo && convo.id === conversationId ? convo.messages : [];
    if (!messages.length) return 0;
    return extractFromConversation(messages, conversationId);
  },
});

function queueMemoryExtraction(): void {
  const convo = useChatStore.getState().current;
  if (convo) extractionQueue.markDirty(convo.id);
}

export function useInference(modelId: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ramWarning, setRamWarning] = useState<RAMWarning | null>(null);
  // Vision ("image understanding") pack state for the active model.
  const [visionReady, setVisionReady] = useState(false);
  const [visionInstalled, setVisionInstalled] = useState(false);
  const [visionProgress, setVisionProgress] = useState<number | null>(null);
  const [visionWorks, setVisionWorks] = useState(false);
  const [visionError, setVisionError] = useState<string | null>(null);
  const profile = useProfileStore((s) => s.profile);
  const chat = useChatStore();

  // Set true once the user chooses "Load Anyway" for the current model.
  const bypassRam = useRef(false);

  const finishVisionInit = useCallback(async () => {
    const ok = await runVisionSelfTest();
    const st = getVisionStatus();
    setVisionWorks(ok);
    setVisionError(st.error);
  }, []);

  const load = useCallback(async () => {
    const model = modelId ? getModelById(modelId) : undefined;
    if (!model) return;
    setLoading(true);
    setError(null);
    setRamWarning(null);
    try {
      await Llama.initLlm(MM.localPath(model), {
        modelSizeGb: model.sizeGb,
        bypassRamCheck: bypassRam.current,
      });
      // Enable image understanding if this model's vision pack is already on
      // disk. Never let a vision failure break model load (that would disable
      // the composer entirely) — it's strictly best-effort.
      setVisionReady(false);
      try {
        if (model.mmprojFilename) {
          const integ = await MM.verifyMmprojIntegrity(model);
          const inst = integ.ok;
          setVisionInstalled(inst);
          const path = MM.mmprojLocalPath(model);
          if (inst && path) {
            const ready = await Llama.initMultimodal(path);
            setVisionReady(ready);
            if (ready) await finishVisionInit();
            else setVisionError(Llama.getVisionStatus().error);
          } else if (integ.reason === 'corrupt') {
            setVisionError('Vision pack was incomplete — re-download it.');
          }
        } else {
          setVisionInstalled(false);
        }
      } catch (visionErr) {
        console.error('[useInference] vision init', visionErr);
      }
    } catch (e) {
      if (e instanceof RAMInsufficientError) {
        setRamWarning({ available: e.available, required: e.required });
        return;
      }
      const msg = e instanceof Error ? e.message : 'MODEL_LOAD_FAILED';
      setError(
        msg === 'INSUFFICIENT_RAM' ? 'Not enough memory — try Gemma 4 E2B.'
        : msg === 'MODEL_NOT_FOUND' ? 'Model file missing — re-download it in Settings.'
        : 'Failed to load the model.',
      );
    } finally {
      setLoading(false);
    }
  }, [modelId, finishVisionInit]);

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
    // Lazily enable vision the first time an image is sent if the pack is on
    // disk but not yet loaded (e.g. downloaded from Settings after model load).
    if (attachment?.type === 'image' && !Llama.isMultimodalReady()) {
      const m = modelId ? getModelById(modelId) : undefined;
      const path = m ? MM.mmprojLocalPath(m) : null;
      if (m?.supportsVision && path && (await MM.isMmprojInstalled(m))) {
        try {
          const ready = await Llama.initMultimodal(path);
          setVisionReady(ready);
          if (ready) await finishVisionInit();
        } catch { /* best-effort */ }
      }
    }
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
  }, [chat, profile, modelId, finishVisionInit]);

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
      const result = await runResearch(text, (status) => setContent(`_${status}_`), history);
      setContent(formatResearchMarkdown(result));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'research failed';
      setContent(`_Research error: ${msg}_`);
    } finally {
      await useChatStore.getState().finishAssistant();
    }
  }, [chat]);

  const stop = useCallback(() => { Llama.stop(); }, []);

  /** Download the active model's vision pack (mmproj), then enable multimodal. */
  const downloadVision = useCallback(async () => {
    const model = modelId ? getModelById(modelId) : undefined;
    if (!model?.mmprojUrl) return;
    setVisionProgress(0);
    await MM.startMmprojDownload(model, {
      onProgress: (pct) => setVisionProgress(pct),
      onDone: async () => {
        setVisionProgress(null);
        setVisionInstalled(true);
        const path = MM.mmprojLocalPath(model);
        if (path) {
          const ready = await Llama.initMultimodal(path);
          setVisionReady(ready);
          if (ready) await finishVisionInit();
        }
      },
      onError: () => setVisionProgress(null),
    });
  }, [modelId, finishVisionInit]);

  const model = modelId ? getModelById(modelId) : undefined;
  const vision = {
    supported: model?.supportsVision ?? false,
    ready: visionReady,
    installed: visionInstalled,
    works: visionWorks,
    error: visionError,
    progress: visionProgress,
    sizeBytes: model?.mmprojSizeBytes ?? 0,
    status: deriveVisionStatus({
      supported: model?.supportsVision ?? false,
      installed: visionInstalled,
      ready: visionReady,
      selfTestPassed: visionWorks,
      error: visionError,
    }),
    download: downloadVision,
  };

  return { loading, error, ramWarning, loadAnyway, dismissRamWarning, send, research, stop, vision };
}
