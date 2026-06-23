jest.mock('@/utils/ramCheck', () => ({ assertRAMSufficient: jest.fn() }));

import { buildPrompt } from './LiteRtService';
import { Message } from '@/types';

const msg = (role: 'user' | 'assistant', content: string): Message =>
  ({ id: content, role, content, createdAt: 0 });

describe('LiteRtService.buildPrompt', () => {
  it('flattens system + turns into a plain transcript ending in "Assistant:"', () => {
    const p = buildPrompt('You are Aether.', [
      msg('user', 'hi'),
      msg('assistant', 'Hello!'),
      msg('user', 'how are you'),
    ]);
    expect(p).toContain('You are Aether.');
    expect(p).toContain('User: hi');
    expect(p).toContain('Assistant: Hello!');
    expect(p).toContain('User: how are you');
    expect(p.trimEnd().endsWith('Assistant:')).toBe(true);
  });

  it('does NOT emit Gemma control tokens (MediaPipe applies its own template)', () => {
    const p = buildPrompt('sys', [msg('user', 'hi')]);
    expect(p).not.toContain('<start_of_turn>');
    expect(p).not.toContain('<end_of_turn>');
    expect(p).not.toContain('<__media__>');
  });

  it('omits empty content and an empty system prompt', () => {
    const p = buildPrompt('', [msg('user', '')]);
    expect(p).not.toContain('User:');
    expect(p.trim()).toBe('Assistant:');
  });
});
