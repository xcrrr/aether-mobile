import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceService } from '@/voice/VoiceService';
import { ensureMicrophonePermission } from '@/voice/permissions';

const DENIED_MESSAGE =
  'Microphone access is required for voice input. Grant it in Settings.';

export interface VoiceState {
  listening: boolean;
  partial: string;
  error: string | null;
  /** Tap action: start if idle, stop (and commit) if listening. */
  toggle: () => Promise<void>;
  /** Cancel without committing a result (long-press). */
  cancel: () => Promise<void>;
  clearError: () => void;
}

/**
 * Drives the singleton {@link voiceService}. `onFinal` receives the committed
 * transcription. Detaches its handlers on unmount (without destroying the
 * native recognizer, which is shared and reused across mounts).
 */
export function useVoice(onFinal: (text: string) => void): VoiceState {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    voiceService.onStart = () => { setListening(true); setPartial(''); };
    voiceService.onEnd = () => { setListening(false); setPartial(''); };
    voiceService.onPartialResult = (t) => setPartial(t);
    voiceService.onResult = (t) => {
      const text = t.trim();
      if (text) onFinalRef.current(text);
    };
    voiceService.onError = (e) => {
      setListening(false);
      setPartial('');
      // "No match"/"didn't catch that" type errors are noisy — keep them muted.
      if (!/no match|no speech|didn't|timeout/i.test(e)) setError(e);
    };
    return () => {
      void voiceService.cancel();
      voiceService.onStart = () => {};
      voiceService.onEnd = () => {};
      voiceService.onPartialResult = () => {};
      voiceService.onResult = () => {};
      voiceService.onError = () => {};
    };
  }, []);

  const toggle = useCallback(async () => {
    setError(null);
    if (voiceService.isListening) {
      await voiceService.stop();
      return;
    }
    const granted = await ensureMicrophonePermission();
    if (!granted) { setError(DENIED_MESSAGE); return; }
    // Don't gate on isAvailable() — under the new architecture it can return a
    // false negative. Just try to start; the recognizer reports the real reason
    // via onError if it genuinely can't run.
    try {
      await voiceService.start('en-US');
    } catch (e) {
      const reason = e instanceof Error && e.message ? e.message : String(e);
      setError(`Could not start voice input: ${reason}`);
    }
  }, []);

  const cancel = useCallback(async () => {
    setListening(false);
    setPartial('');
    await voiceService.cancel();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { listening, partial, error, toggle, cancel, clearError };
}
