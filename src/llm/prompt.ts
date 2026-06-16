import { Message, UserProfile } from '@/types';

const BASE =
  'You are Aether, a private on-device AI assistant with no internet access. ' +
  'Be helpful, honest, and concise. Use markdown when it improves clarity.';

export function buildSystemPrompt(profile: UserProfile | null): string {
  if (!profile) return BASE;
  const parts = [BASE];
  if (profile.name) parts.push(`The user's name is ${profile.name}.`);
  if (profile.occupation) parts.push(`They work as ${profile.occupation}.`);
  if (profile.project) parts.push(`They are working on: ${profile.project}.`);
  if (profile.goals) parts.push(`They want help with: ${profile.goals}.`);
  if (profile.language) parts.push(`Always reply in ${profile.language}.`);
  return parts.join(' ');
}

/** Gemma has no system role — prepend system text to the first user turn. */
export function buildGemmaPrompt(system: string, messages: Message[]): string {
  let pending = system;
  let out = '';
  for (const m of messages) {
    if (m.role === 'user') {
      const text = pending ? `${pending}\n\n${m.content}` : m.content;
      pending = '';
      out += `<start_of_turn>user\n${text}<end_of_turn>\n<start_of_turn>model\n`;
    } else {
      out += `${m.content}<end_of_turn>\n`;
    }
  }
  return out;
}

/** Rough char-budget trim (~4 chars/token), always keeping the newest messages. */
export function trimToContext(messages: Message[], nCtx: number): Message[] {
  const budget = nCtx * 4 * 0.6; // leave room for the reply
  let total = 0;
  const kept: Message[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    total += messages[i].content.length;
    if (total > budget && kept.length > 0) break;
    kept.unshift(messages[i]);
  }
  return kept;
}
