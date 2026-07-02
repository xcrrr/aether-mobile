import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ensureMicrophonePermission } from '@/voice/permissions';
import { useProfileStore } from '@/state/useProfileStore';
import type { VoiceService } from '@/voice/VoiceService';

const DENIED_MESSAGE =
  'Microphone access is required for voice input. Grant it in Settings.';

let loadedVoiceService: VoiceService | null = null;

function getVoiceService(): VoiceService {
  if (!loadedVoiceService) {
    loadedVoiceService = (require('@/voice/VoiceService') as typeof import('@/voice/VoiceService')).voiceService;
  }
  return loadedVoiceService;
}

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

function systemLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
  } catch {
    return 'en-US';
  }
}

function localeForLanguage(language?: string): string {
  const lang = (language ?? '').trim().toLowerCase();
  const sys = systemLocale();
  if (!lang || lang === 'system') return sys;
  if (lang.includes('polish') || lang === 'pl' || lang.startsWith('polski')) return 'pl-PL';
  if (lang.includes('english') || lang === 'en') return sys.startsWith('en') ? sys : 'en-US';
  if (lang.includes('spanish') || lang === 'es') return sys.startsWith('es') ? sys : 'es-ES';
  if (lang.includes('german') || lang === 'de') return sys.startsWith('de') ? sys : 'de-DE';
  if (lang.includes('french') || lang === 'fr') return sys.startsWith('fr') ? sys : 'fr-FR';
  return sys;
}

/**
 * Drives the singleton VoiceService. The native recognizer module is imported
 * lazily so route discovery cannot break app launch on devices without speech
 * services.
 */
export function useVoice(onFinal: (text: string) => void): VoiceState {
  const profileLanguage = useProfileStore((s) => s.profile?.language);
  const locale = useMemo(() => localeForLanguage(profileLanguage), [profileLanguage]);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    let alive = true;
    let svc: VoiceService | null = null;

    try {
      const voiceService = getVoiceService();
      if (!alive) return;
      svc = voiceService;
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
        if (!/no match|no speech|didn't|timeout/i.test(e)) setError(e);
      };
    } catch (e) {
      const reason = e instanceof Error && e.message ? e.message : String(e);
      setError(`Voice input unavailable: ${reason}`);
    }

    return () => {
      alive = false;
      if (!svc) return;
      void svc.cancel();
      svc.onStart = () => {};
      svc.onEnd = () => {};
      svc.onPartialResult = () => {};
      svc.onResult = () => {};
      svc.onError = () => {};
    };
  }, []);

  const toggle = useCallback(async () => {
    setError(null);
    const voiceService = getVoiceService();
    if (voiceService.isListening) {
      await voiceService.stop();
      return;
    }
    const granted = await ensureMicrophonePermission();
    if (!granted) { setError(DENIED_MESSAGE); return; }
    try {
      await voiceService.start(locale);
    } catch (e) {
      const reason = e instanceof Error && e.message ? e.message : String(e);
      setError(`Could not start voice input: ${reason}`);
    }
  }, [locale]);

  const cancel = useCallback(async () => {
    setListening(false);
    setPartial('');
    const voiceService = getVoiceService();
    await voiceService.cancel();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { listening, partial, error, toggle, cancel, clearError };
}
