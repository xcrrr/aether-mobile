import * as Haptics from 'expo-haptics';
import { useProfileStore } from '@/state/useProfileStore';

/**
 * A faint, continuous tick for as long as Aether is writing, so a reply
 * arriving is something you can feel rather than only see.
 *
 * Modelled on ChatGPT's mobile app, which vibrates from the moment you send
 * until the reply is finished. The important detail is that it runs on a timer
 * for the whole generation rather than firing per token: a token is often only
 * a few characters, so token-driven feedback fires far faster than a motor can
 * answer, and it falls silent whenever the model pauses. A steady interval
 * gives an even texture and keeps going through those pauses, including the
 * gap before the first character appears.
 *
 * That same app's haptics are also its most complained-about feature, to the
 * point that it ships a switch to turn them off. So this is switchable, the
 * switch is honoured on the very next tick rather than at the next reply, and
 * the softest impact style is used rather than the default medium.
 */
const TICK_MS = 90;

let timer: ReturnType<typeof setInterval> | null = null;

function tick(): void {
  // Read the setting per tick, so turning the switch off stops an in-flight
  // reply immediately instead of at the end of it.
  if (!useProfileStore.getState().replyHaptics) return;
  // Never surface a haptics failure: a device with no motor, or one in a mode
  // that suppresses feedback, must not break the reply it is decorating.
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => undefined);
}

/** Begin ticking. Safe to call when already running. */
export function startReplyHaptics(): void {
  if (timer) return;
  tick();
  timer = setInterval(tick, TICK_MS);
}

/**
 * Stop ticking. Safe to call when not running, and must be called on every exit
 * from a generation — completion, error and cancellation alike — or the phone
 * buzzes forever.
 */
export function stopReplyHaptics(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

/** Test seam: is the ticker currently running? */
export function isReplyHapticsRunning(): boolean {
  return timer !== null;
}
