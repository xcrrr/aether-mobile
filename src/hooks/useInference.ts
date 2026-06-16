import { useEffect, useState, useCallback } from 'react';
import * as Llama from '@/llm/LlamaService';
import { buildSystemPrompt } from '@/llm/prompt';
import { useChatStore } from '@/state/useChatStore';
import { useProfileStore } from '@/state/useProfileStore';
import { getModelById } from '@/models/registry';
import * as MM from '@/models/ModelManager';

export function useInference(modelId: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profile = useProfileStore((s) => s.profile);
  const chat = useChatStore();

  // Load the model whenever the chat (model) opens.
  useEffect(() => {
    const model = modelId ? getModelById(modelId) : undefined;
    if (!model) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await Llama.initLlm(MM.localPath(model));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'MODEL_LOAD_FAILED';
        if (!cancelled) {
          setError(
            msg === 'INSUFFICIENT_RAM' ? 'Not enough memory — try Gemma 4 E2B.'
            : msg === 'MODEL_NOT_FOUND' ? 'Model file missing — re-download it in Settings.'
            : 'Failed to load the model.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [modelId]);

  const send = useCallback(async (text: string) => {
    await chat.appendUser(text);
    const system = buildSystemPrompt(profile);
    const messages = useChatStore.getState().current?.messages ?? [];
    chat.startAssistant();
    await Llama.generate(
      system,
      messages,
      (token) => useChatStore.getState().appendToken(token),
      () => useChatStore.getState().finishAssistant(),
      (e) => {
        useChatStore.getState().appendToken(`\n\n_Error: ${e}_`);
        useChatStore.getState().finishAssistant();
      },
    );
  }, [chat, profile]);

  const stop = useCallback(() => { Llama.stopGeneration(); }, []);

  return { loading, error, send, stop };
}
