import { Message } from '@/types';
import * as Llama from '@/llm/engine';
import { buildGemmaPrompt } from '@/llm/prompt';

// One short generation per conversation, the moment the first reply lands. Tiny
// token budget keeps it near-instant and out of the way of the next chat send.
const MAX_TITLE_TOKENS = 16;
const TITLE_TEMPERATURE = 0.3;

const INSTRUCTION =
  'Write a short, specific title for this conversation: 3 to 5 words, Title Case, ' +
  'no quotes, no trailing punctuation, no emoji. Capture the actual topic. ' +
  'If the conversation is just a greeting with no topic yet, reply exactly with: New chat. ' +
  'Reply with ONLY the title.\n\nConversation:\n';

/** Strip fences/quotes/markdown the small model tends to wrap the title in. */
export function cleanTitle(raw: string): string | null {
  const line = raw.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const t = line
    .replace(/^(title\s*[:\-]\s*)/i, '')
    .replace(/^["'`*#\s]+/, '')
    .replace(/["'`*.\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t || /^new chat$/i.test(t)) return null;
  return t.slice(0, 48);
}

/** Generate a concise title from the first exchange. Returns null if the model
 *  is busy/unavailable or the chat has no topic worth naming yet. */
export async function generateTitle(messages: Message[]): Promise<string | null> {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return null;
  const firstAssistant = messages.find((m) => m.role === 'assistant' && m.content.trim());
  const convo =
    `User: ${firstUser.content.trim().slice(0, 400)}` +
    (firstAssistant ? `\nAssistant: ${firstAssistant.content.trim().slice(0, 400)}` : '');
  const prompt = buildGemmaPrompt('', [
    { id: 'title', role: 'user', content: `${INSTRUCTION}${convo}\n\nTitle:`, createdAt: 0 },
  ]);
  let raw: string | null;
  try {
    raw = await Llama.extract(prompt, { maxTokens: MAX_TITLE_TOKENS, temperature: TITLE_TEMPERATURE });
  } catch {
    return null;
  }
  return raw ? cleanTitle(raw) : null;
}
