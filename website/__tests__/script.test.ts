import { conversation } from '@/content/script';
import type { Beat } from '@/components/phone/useTypewriter';

test('script alternates user/assistant and is non-empty', () => {
  expect(conversation.length).toBeGreaterThanOrEqual(4);
  conversation.forEach((b: Beat, i) => {
    expect(b.text.length).toBeGreaterThan(0);
    expect(b.role).toBe(i % 2 === 0 ? 'user' : 'assistant');
  });
});

test('every beat carries a caption for the story column', () => {
  conversation.forEach((b) => {
    expect(b.caption && b.caption.length > 0).toBe(true);
  });
});

// Product-truthfulness guard: the demo must never drift into absolute claims.
const BANNED = [
  /100%/i,
  /nothing (ever )?leaves your (phone|device)/i,
  /fully (offline|private|secure|autonomous)/i,
  /untrackable/i,
  /no cloud/i,
];

test('script avoids unsupported absolute claims', () => {
  const all = conversation.map((b) => `${b.text} ${b.caption ?? ''}`).join(' ');
  for (const re of BANNED) {
    expect(all).not.toMatch(re);
  }
});
