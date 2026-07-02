import { resolveTimeline, Beat } from '@/components/phone/useTypewriter';

const beats: Beat[] = [
  { role: 'user', text: 'Hi' },
  { role: 'assistant', text: 'Hello world' },
];

test('at p=0 nothing is revealed', () => {
  const s = resolveTimeline(beats, 0);
  expect(s.shown).toHaveLength(0);
  expect(s.streamingIndex).toBe(0);
  expect(s.revealed).toBe('');
});

test('at p=1 everything is fully revealed', () => {
  const s = resolveTimeline(beats, 1);
  expect(s.shown.map((m) => m.text)).toEqual(['Hi', 'Hello world']);
  expect(s.streamingIndex).toBe(-1);
});

test('mid-progress streams the assistant message partially', () => {
  const s = resolveTimeline(beats, 0.75);
  expect(s.shown.map((m) => m.text)).toEqual(['Hi']);
  expect(s.streamingIndex).toBe(1);
  expect(s.revealed.length).toBeGreaterThan(0);
  expect(s.revealed.length).toBeLessThan('Hello world'.length);
  expect('Hello world'.startsWith(s.revealed)).toBe(true);
});
