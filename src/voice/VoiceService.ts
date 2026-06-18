import Voice, {
  type SpeechResultsEvent,
  type SpeechErrorEvent,
} from '@react-native-voice/voice';

/** No-op default so callers never have to null-check the handlers. */
const noop = (): void => {};

/**
 * Singleton wrapper around Android's native SpeechRecognizer (via
 * `@react-native-voice/voice`).
 *
 * Uses the device's built-in recognition engine — no model download, and
 * offline recognition on Android 10+. One recognizer at a time: starting a
 * new session while one is active first cancels the old one.
 */
class VoiceServiceImpl {
  /** Final recognized text (best hypothesis). */
  onResult: (text: string) => void = noop;
  /** Interim, partial hypotheses while the user is still speaking. */
  onPartialResult: (text: string) => void = noop;
  /** Human-readable error string. */
  onError: (error: string) => void = noop;
  /** Recognizer started capturing audio. */
  onStart: () => void = noop;
  /** Recognizer stopped (silence timeout, explicit stop, or error). */
  onEnd: () => void = noop;

  private listening = false;

  constructor() {
    Voice.onSpeechStart = this.handleStart;
    Voice.onSpeechEnd = this.handleEnd;
    Voice.onSpeechResults = this.handleResults;
    Voice.onSpeechPartialResults = this.handlePartial;
    Voice.onSpeechError = this.handleError;
  }

  get isListening(): boolean {
    return this.listening;
  }

  private handleStart = (): void => {
    this.listening = true;
    this.onStart();
  };

  private handleEnd = (): void => {
    this.listening = false;
    this.onEnd();
  };

  private handleResults = (e: SpeechResultsEvent): void => {
    const text = e.value?.[0]?.trim() ?? '';
    if (text) this.onResult(text);
  };

  private handlePartial = (e: SpeechResultsEvent): void => {
    const text = e.value?.[0]?.trim() ?? '';
    if (text) this.onPartialResult(text);
  };

  private handleError = (e: SpeechErrorEvent): void => {
    this.listening = false;
    this.onError(e.error?.message ?? 'Speech recognition failed.');
  };

  /** Start listening. `locale` defaults to `en-US`. */
  async start(locale = 'en-US'): Promise<void> {
    if (this.listening) await this.cancel();
    await Voice.start(locale);
  }

  /** Stop listening and trigger the final result. */
  async stop(): Promise<void> {
    if (!this.listening) return;
    await Voice.stop();
  }

  /** Cancel listening without emitting a final result. */
  async cancel(): Promise<void> {
    this.listening = false;
    await Voice.cancel();
  }

  /** Tear down the recognizer and detach every listener. */
  async destroy(): Promise<void> {
    this.listening = false;
    await Voice.destroy();
    Voice.removeAllListeners();
    this.onResult = noop;
    this.onPartialResult = noop;
    this.onError = noop;
    this.onStart = noop;
    this.onEnd = noop;
  }

  /** Whether the device exposes a speech recognition service. */
  async isAvailable(): Promise<boolean> {
    try {
      const available = await Voice.isAvailable();
      // The native API returns 1/0 on Android, boolean on iOS.
      return Boolean(available);
    } catch {
      return false;
    }
  }
}

export type VoiceService = VoiceServiceImpl;
export const voiceService = new VoiceServiceImpl();
