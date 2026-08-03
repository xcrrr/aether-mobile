import * as Haptics from 'expo-haptics';
import { useProfileStore } from '@/state/useProfileStore';

/**
 * A faint tick under a reply as it streams, so an answer arriving feels like
 * something happening rather than text appearing silently.
 *
 * Two things shape this. First, tokens arrive far faster than a motor can
 * respond — a token is often a few characters, so a fluent reply produces tens
 * of callbacks a second. Firing on each one would queue work the vibrator
 * cannot drain, and the result is a solid buzz rather than texture. The tick is
 * therefore rate-limited, and the limit is what makes it read as a texture at
 * all.
 *
 * Second, the reference implementation for this — ChatGPT's — vibrates
 * continuously until a reply finishes, and that is the single most complained
 * about thing in its mobile app, to the point that it ships a switch to turn it
 * off. So this is off-switchable from Settings, and uses the softest impact
 * available rather than the default medium.
 */
const MIN_INTERVAL_MS = 60;

let lastAt = 0;

/** Call once per streamed token. Cheap and self-limiting; safe to call hot. */
export function replyHapticTick(): void {
  if (!useProfileStore.getState().replyHaptics) return;
  const now = Date.now();
  if (now - lastAt < MIN_INTERVAL_MS) return;
  lastAt = now;
  // Never surface a haptics failure: a device with no motor, or one in a mode
  // that suppresses feedback, must not break the reply it is decorating.
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => undefined);
}

/** Let the next reply tick immediately instead of inheriting the last one's timing. */
export function resetReplyHaptics(): void {
  lastAt = 0;
}
