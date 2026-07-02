export interface Beat {
  role: 'user' | 'assistant';
  text: string;
  caption?: string; // short, user-friendly explanation shown beside the phone
}

export interface TimelineState {
  shown: Beat[];
  streamingIndex: number;
  revealed: string;
}

export function resolveTimeline(beats: Beat[], p: number): TimelineState {
  const n = beats.length;
  if (n === 0) return { shown: [], streamingIndex: -1, revealed: '' };
  if (p <= 0) return { shown: [], streamingIndex: 0, revealed: '' };
  if (p >= 1) return { shown: beats.slice(), streamingIndex: -1, revealed: '' };
  const slice = 1 / n;
  const idx = Math.min(n - 1, Math.floor(p / slice));
  const local = (p - idx * slice) / slice;
  const shown = beats.slice(0, idx);
  const beat = beats[idx];
  if (beat.role === 'user') {
    return { shown: beats.slice(0, idx + 1), streamingIndex: -1, revealed: '' };
  }
  const count = Math.max(0, Math.min(beat.text.length, Math.floor(local * beat.text.length)));
  return { shown, streamingIndex: idx, revealed: beat.text.slice(0, count) };
}
