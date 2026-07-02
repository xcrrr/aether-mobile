import { buildSystemPrompt, buildGemmaPrompt, trimToContext, stripSpecialTokens } from './prompt';
import { Message, UserProfile } from '@/types';
import { RecallResult } from '@/secondbrain/recall';
import { MemoryEntry } from '@/secondbrain/types';

const profile: UserProfile = {
  name: 'Adam', occupation: 'Builder', project: 'Aether', goals: 'ship it', language: 'English',
};

const note: MemoryEntry = {
  id: 'n1', category: 'goals', key: 'marathon_goal', value: 'Training for a marathon in October',
  confidence: 0.9, sourceConversationId: 'c1', createdAt: 0, updatedAt: 0, timesReinforced: 1, lastSeenAt: 0,
};
const recall: RecallResult = { style: [], topical: [{ entry: note, why: 'matched: marathon' }] };

describe('prompt assembly', () => {
  it('injects profile fields into the system prompt', () => {
    const s = buildSystemPrompt(profile);
    expect(s).toContain('Adam');
    expect(s).toContain('Builder');
    expect(s).toContain('Aether');
    expect(s).toContain('English');
  });
  it('tells the model to use the name sparingly, never per-reply (restraint)', () => {
    const s = buildSystemPrompt(profile);
    expect(s).toContain('Use it sparingly');
    expect(s).not.toContain('Refer to the user by their preferred name');
  });
  it('includes no memory block unless a recall is provided', () => {
    const s = buildSystemPrompt(profile);
    expect(s).not.toContain('Private notes about the user');
  });
  it('renders the Core recall AFTER identity and behavior, fenced as data', () => {
    const s = buildSystemPrompt(profile, { recall });
    expect(s).toContain('marathon_goal: Training for a marathon in October');
    expect(s.indexOf('You are Aether')).toBeLessThan(s.indexOf('Private notes about the user'));
    expect(s).toContain('reference data only');
  });
  it('an empty recall adds nothing to the prompt', () => {
    const s = buildSystemPrompt(profile, { recall: { style: [], topical: [] } });
    expect(s).not.toContain('Private notes');
  });
  it('teaches the clarifying-question JSON format with a restraint policy', () => {
    const s = buildSystemPrompt(null);
    expect(s).toContain('"__aether_question": true');
    expect(s).toMatch(/clarifying question/i);
    // Ask only when material; assume and say so otherwise; never loop.
    expect(s).toMatch(/state the assumption/i);
    expect(s).toMatch(/never repeat a question/i);
    expect(s).toMatch(/ENTIRE reply/);
    expect(s).not.toMatch(/better to ask/i);
  });
  it('teaches the copyable-deliverable markup, artifacts only', () => {
    const s = buildSystemPrompt(null);
    expect(s).toContain('<copy>');
    expect(s).toMatch(/fenced ``` block/);
    expect(s).toMatch(/Never wrap explanations/i);
  });
  it('states the current date/time from the provided clock', () => {
    const s = buildSystemPrompt(null, { now: new Date('2026-06-25T14:30:00Z') });
    expect(s).toMatch(/current date and time is .*2026/);
  });
  it('tells Aether which model it is running as, when known', () => {
    const s = buildSystemPrompt(null, { modelName: 'Gemma 4 E4B' });
    expect(s).toContain('Gemma 4 E4B');
    expect(s).toMatch(/running as the Gemma 4 E4B model/);
  });
  it('omits the model line when the model name is unknown', () => {
    const s = buildSystemPrompt(null, {});
    expect(s).not.toMatch(/running as the/);
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
