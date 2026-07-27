import { Message } from '@/types';
import { sanitizeModelText, clampChars } from '@/webresearch/safety';

/**
 * The one conversation-grounding builder Task uses to see what Chat/Research
 * already established in this conversation — recent turns plus the most
 * recent structured research handoff (see Message.research). This is what
 * lets "make a document about why he died" resolve "he" and see what Research
 * actually found, instead of Task starting from a blank goal string.
 *
 * Deliberately NOT the full raw transcript: bounded turns/chars, same
 * trust-boundary treatment as web content (sanitizeModelText + clampChars) since
 * this text still rides into a model prompt as reference data, not instructions.
 * Callers (agent/prompts.ts) clamp the result again to their own prompt budget —
 * this builder only avoids handing back something absurdly large.
 */

const RECENT_TURNS = 8;
const TURN_CHARS = 220;
const RESEARCH_ANSWER_CHARS = 900;
const RESEARCH_SOURCES = 4;
const MULTI_TURN_ATTACHMENTS = /\b(both|all (?:the )?(?:attachments|documents|files)|previous|earlier|other (?:attachment|document|file))\b/i;

function extractedAttachments(messages: Message[]): { name: string; text: string }[] {
  return messages
    .flatMap((message) => message.attachments ?? [])
    .filter((attachment) => !!attachment.extractedText)
    .map((attachment) => ({ name: attachment.name, text: attachment.extractedText! }));
}

export function buildTaskAttachments(
  messages: Message[],
  goal = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '',
): { name: string; text: string }[] {
  const userMessages = messages.filter((message) => message.role === 'user');
  const current = userMessages[userMessages.length - 1];
  const currentAttachments = current ? extractedAttachments([current]) : [];
  if (currentAttachments.length && !MULTI_TURN_ATTACHMENTS.test(goal)) {
    return currentAttachments;
  }
  return extractedAttachments(userMessages);
}

export function buildConversationContext(messages: Message[]): string {
  if (!messages.length) return '';
  const parts: string[] = [];

  const recent = messages.slice(-RECENT_TURNS).filter((m) => m.content.trim());
  if (recent.length) {
    const lines = recent.map(
      (m) => `${m.role === 'user' ? 'User' : 'Aether'}: ${clampChars(sanitizeModelText(m.content), TURN_CHARS)}`,
    );
    parts.push(`Recent conversation:\n${lines.join('\n')}`);
  }

  const lastResearch = [...messages].reverse().find((m) => m.research);
  if (lastResearch?.research) {
    const { query, answer, sources } = lastResearch.research;
    const sourceLines = sources
      .slice(0, RESEARCH_SOURCES)
      .map((s) => `- ${sanitizeModelText(s.title || s.url)} (${sanitizeModelText(s.url)})`)
      .join('\n');
    parts.push(
      `Prior research in this conversation (topic: ${clampChars(sanitizeModelText(query), 200)}):\n` +
      `${clampChars(sanitizeModelText(answer), RESEARCH_ANSWER_CHARS)}` +
      (sourceLines ? `\nSources:\n${sourceLines}` : ''),
    );
  }

  return parts.join('\n\n');
}
