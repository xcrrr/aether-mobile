'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Deterministic demo clock. Each demo is a pure render of elapsed time `t`,
 * so a given millisecond always shows the same frame — nothing is randomized.
 *
 * - plays only while the demo is on screen (IntersectionObserver)
 * - loops after `hold` ms of quiet settle at the end
 * - reduced motion: pinned to `restAt` (the strongest completed state), no rAF
 */
export function useDemoClock({ duration, hold = 3600, restAt }: {
  duration: number;
  hold?: number;
  restAt: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [t, setT] = useState(0);
  const [staticMode, setStaticMode] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStaticMode(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let start = 0;
    let last = -1;
    const total = duration + hold;

    const tick = (now: number) => {
      if (!start) start = now;
      const next = (now - start) % total;
      // ~30fps is plenty for this choreography and halves React work.
      if (next - last > 33 || next < last) {
        last = next;
        setT(next);
      }
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        raf = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(raf);
        start = 0;
      }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [duration, hold]);

  return { ref, t: staticMode ? restAt : t, staticMode };
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Linear progress of t through [a, b], clamped. */
export const prog = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

/** Human typing into the composer: char-based with a steady cadence. */
export function typeSlice(text: string, t: number, a: number, b: number): string {
  return text.slice(0, Math.round(prog(t, a, b) * text.length));
}

/**
 * Model output: reveal whole words in small bursts, the way tokens land,
 * rather than a smooth per-character typewriter.
 */
export function streamSlice(text: string, t: number, a: number, b: number): string {
  const p = prog(t, a, b);
  if (p <= 0) return '';
  if (p >= 1) return text;
  let count = 0;
  const target = p * text.length;
  while (count < target) {
    const nextSpace = text.indexOf(' ', count + 1);
    if (nextSpace === -1) return text;
    count = nextSpace;
  }
  return text.slice(0, count);
}

/** Fade the whole recording out at the end of the cycle so the loop reads as a cut, not a jump. */
export function loopOpacity(t: number, duration: number, hold: number): number {
  const total = duration + hold;
  if (t > total - 420) return clamp01((total - t) / 420);
  if (t < 260) return clamp01(t / 260);
  return 1;
}
