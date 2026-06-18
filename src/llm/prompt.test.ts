import { buildSystemPrompt, buildGemmaPrompt, trimToContext, stripSpecialTokens } from './prompt';
import { Message, UserProfile } from '@/types';

const profile: UserProfile = {
  name: 'Adam', occupation: 'Builder', project: 'Aether', goals: 'ship it', language: 'English',
};

describe('prompt assembly', () => {
  it('injects profile fields into the system prompt', () => {
    const s = buildSystemPrompt(profile);
    expect(s).toContain('Adam');
    expect(s).toContain('Builder');
    expect(s).toContain('Aether');
    expect(s).toContain('English');
  });
  it('prepends system content to the first user turn (Gemma format)', () => {
    const msgs: Message[] = [{ id: '1', role: 'user', content: 'Hi', createdAt: 0 }];
    const p = buildGemmaPrompt('SYS', msgs);
    expect(p).toBe('<start_of_turn>user\nSYS\n\nHi<end_of_turn>\n<start_of_turn>model\n');
  });
  it('formats a multi-turn conversation', () => {
    const msgs: Message[] = [
      { id: '1', role: 'user', content: 'Hi', createdAt: 0 },
      { id: '2', role: 'assistant', content: 'Hello', createdAt: 1 },
      { id: '3', role: 'user', content: 'Bye', createdAt: 2 },
    ];
    const p = buildGemmaPrompt('SYS', msgs);
    expect(p).toContain('<start_of_turn>model\nHello<end_of_turn>');
    expect(p.endsWith('<start_of_turn>user\nBye<end_of_turn>\n<start_of_turn>model\n')).toBe(true);
  });
  it('strips full and partial Gemma turn markers from a reply', () => {
    expect(stripSpecialTokens('Hello there<end_of_turn>')).toBe('Hello there');
    expect(stripSpecialTokens('What would you like to tell me?\n<end_of_turn')).toBe('What would you like to tell me?');
    expect(stripSpecialTokens('Done<start_of')).toBe('Done');
    expect(stripSpecialTokens('clean answer')).toBe('clean answer');
  });
  it('trims oldest messages when over the limit, keeping the newest', () => {
    const msgs: Message[] = Array.from({ length: 10 }, (_, i) => ({
      id: String(i), role: i % 2 === 0 ? 'user' : 'assistant', content: 'x'.repeat(2000), createdAt: i,
    }));
    const trimmed = trimToContext(msgs, 2048);
    expect(trimmed.length).toBeLessThan(msgs.length);
    expect(trimmed[trimmed.length - 1].id).toBe('9');
  });
});
