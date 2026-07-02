jest.mock('@/utils/ramCheck', () => ({ assertRAMSufficient: jest.fn() }));

import { splitConversation } from './LiteRtService';
import { Message } from '@/types';

const msg = (role: 'user' | 'assistant', content: string): Message =>
  ({ id: content, role, content, createdAt: 0 });

describe('LiteRtService.splitConversation', () => {
  it('separates system, prior turns, and the new user turn', () => {
    const { system, historyJson, lastText } = splitConversation('You are Aether.', [
      msg('user', 'hi'),
      msg('assistant', 'Hello!'),
      msg('user', 'how are you'),
    ]);
    expect(system).toBe('You are Aether.');
    expect(lastText).toBe('how are you');
    expect(JSON.parse(historyJson)).toEqual([
      { role: 'user', text: 'hi' },
      { role: 'model', text: 'Hello!' },
    ]);
  });

  it('maps assistant role to litertlm "model" and drops empty turns', () => {
    const { historyJson } = splitConversation('', [
      msg('user', 'a'),
      msg('assistant', ''),
      msg('assistant', 'b'),
      msg('user', 'q'),
    ]);
    expect(JSON.parse(historyJson)).toEqual([
      { role: 'user', text: 'a' },
      { role: 'model', text: 'b' },
    ]);
  });

  it('does NOT flatten into a "User:/Assistant:" blob (no fake-turn tokens)', () => {
    const { lastText, historyJson, system } = splitConversation('sys', [msg('user', 'hi')]);
    expect(lastText).toBe('hi');
    expect(historyJson).toBe('[]');
    expect(system + lastText).not.toContain('Assistant:');
  });
});
