import { Message, UserProfile, FileAttachment } from '@/types';
import { MemoryStore } from '@/secondbrain/MemoryStore';
import { buildMemorySystemPrompt } from '@/secondbrain/MemoryInjector';

/** llama.rn's multimodal placeholder — marks where image tokens are injected. */
const MEDIA_MARKER = '<__media__>';

const BASE =
  'You are Aether, a private on-device AI assistant. ' +
  'Answer like a sharp, helpful friend: give a complete, genuinely useful answer, ' +
  'then stop. Match the depth to the question — a greeting or quick question gets ' +
  'a short, warm reply (a sentence or two); a real question that needs explaining ' +
  'gets a full, thorough answer that actually covers it. Do NOT cut substance ' +
  'short just to be brief, and do NOT pad a simple message to seem thorough — ' +
  'judge what the user actually needs and deliver exactly that. ' +
  'Use markdown when it genuinely helps a longer answer (## headings, **bold** for ' +
  'key terms, bullet or numbered lists); skip the formatting for short replies and ' +
  'just talk.\n\n' +
  'HONESTY (critical): Be 100% truthful. Never invent facts, sources, or details. ' +
  'If you do not know something, are unsure, or cannot perceive something (such ' +
  'as an image you cannot actually see), say so plainly instead of guessing or ' +
  'making things up. It is always better to admit uncertainty than to fabricate.\n\n' +
  'Never output special control tokens such as <end_of_turn>, <start_of_turn>, ' +
  '<eos> or <bos> in your reply. Just write the plain answer and stop.';

export function buildSystemPrompt(profile: UserProfile | null): string {
  const parts: string[] = [];

  // Second Brain — prepend learned memory when enabled.
  if (MemoryStore.isEnabled()) {
    const memory = buildMemorySystemPrompt(MemoryStore.getAllEntries());
    if (memory) parts.push(memory);
  }

  parts.push(BASE);
  if (profile?.name) parts.push(`The user's name is ${profile.name}.`);
  if (profile?.occupation) parts.push(`They work as ${profile.occupation}.`);
  if (profile?.project) parts.push(`They are working on: ${profile.project}.`);
  if (profile?.goals) parts.push(`They want help with: ${profile.goals}.`);
  if (profile?.language) parts.push(`Always reply in ${profile.language}.`);
  return parts.join('\n\n');
}

const TYPE_LABEL: Record<FileAttachment['type'], string> = {
  image: 'image', pdf: 'PDF', text: 'text file', docx: 'Word document',
};

/**
 * Weave a user message's attachments into its text so the model sees them:
 *  - images get a short "analyze the attached image" preamble (the pixels are
 *    delivered separately through the multimodal API)
 *  - documents have their extracted text injected as a quoted block
 *  - unreadable documents fall back to naming the file and asking the user to
 *    paste the relevant text
 */
export function buildUserContent(message: Message, visionActive = false): string {
  const attachments = message.attachments ?? [];
  if (attachments.length === 0) return message.content;

  const blocks: string[] = [];
  for (const a of attachments) {
    if (a.type === 'image') {
      // Only claim the image is viewable when its pixels are actually being fed
      // to the model (a projector is loaded). The MEDIA_MARKER tells llama.rn
      // where to inject the image tokens — without it the pixels are ignored and
      // the model would hallucinate a description.
      blocks.push(visionActive
        ? `${MEDIA_MARKER}\nThe user shared this image. Describe and analyze ONLY what is actually visible in it. Do not invent anything you cannot see.`
        : 'The user attached an image, but image viewing is not enabled right now, so you genuinely cannot see it. Tell the user you can\'t view the image yet (they can enable image understanding to download the vision pack) and do NOT guess or make up what it shows.');
    } else if (a.extractedText) {
      const meta = a.pageCount
        ? `${TYPE_LABEL[a.type]}, ${a.pageCount} pages`
        : `${TYPE_LABEL[a.type]}, ${a.extractedText.length} chars`;
      blocks.push(
        `The user has attached a document: "${a.name}" (${meta})\n` +
        `Document contents:\n${a.extractedText}`,
      );
    } else {
      blocks.push(
        `The user has attached a ${TYPE_LABEL[a.type]} named "${a.name}". ` +
        'Its contents could not be read directly. Ask the user to copy-paste the relevant text.',
      );
    }
  }

  const userMessage = message.content.trim();
  const prefix = blocks.join('\n\n');
  return userMessage ? `${prefix}\n\nUser's message: ${userMessage}` : prefix;
}

/** Gemma has no system role — prepend system text to the first user turn. */
export function buildGemmaPrompt(system: string, messages: Message[], visionActive = false): string {
  // The media marker may appear ONLY on the last user turn: only that turn's
  // images are forwarded to native (writeImagePaths), and native requires the
  // <__media__> marker count to equal the number of bitmaps. A marker on an
  // older image turn would have no matching bitmap → decode mismatch/failure.
  let lastUserIdx = -1;
  for (let i = 0; i < messages.length; i++) if (messages[i].role === 'user') lastUserIdx = i;

  let pending = system;
  let out = '';
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'user') {
      const content = buildUserContent(m, visionActive && i === lastUserIdx);
      const text = pending ? `${pending}\n\n${content}` : content;
      pending = '';
      out += `<start_of_turn>user\n${text}<end_of_turn>\n<start_of_turn>model\n`;
    } else {
      out += `${m.content}<end_of_turn>\n`;
    }
  }
  return out;
}

const SPECIAL_TOKENS = ['<end_of_turn>', '<start_of_turn>', '<eos>', '<bos>', '<pad>', '<unk>'];

/**
 * Strip Gemma turn markers — and any trailing *partial* marker — from generated
 * text. llama.rn can stream the first chars of a stop token before the stop
 * matches (e.g. a reply ending in "<end_of_turn"), so we also trim a trailing
 * prefix of either marker.
 */
export function stripSpecialTokens(text: string): string {
  let out = text;
  // Tolerant of spaces/underscores and an optional slash, so variants like
  // "<end of turn>", "< end_of_turn >" or "</end_of_turn>" are all removed.
  out = out.replace(/<\s*\/?\s*(?:end|start)[\s_]*of[\s_]*turn\s*>/gi, '');
  out = out.replace(/<\s*\/?\s*(?:eos|bos|pad|unk)\s*>/gi, '');
  // Exact tokens (catch anything the patterns above missed).
  for (const t of SPECIAL_TOKENS) out = out.split(t).join('');
  // Trailing *partial* of a streamed stop token (e.g. a reply ending "<end_of").
  for (const t of SPECIAL_TOKENS) {
    for (let len = t.length - 1; len > 0; len--) {
      const frag = t.slice(0, len);
      if (out.endsWith(frag)) { out = out.slice(0, -frag.length); break; }
    }
  }
  return out.replace(/\s+$/, '');
}

/** Rough char-budget trim (~4 chars/token), always keeping the newest messages. */
export function trimToContext(messages: Message[], nCtx: number): Message[] {
  const budget = nCtx * 4 * 0.6; // leave room for the reply
  let total = 0;
  const kept: Message[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    total += m.role === 'user' ? buildUserContent(m).length : m.content.length;
    if (total > budget && kept.length > 0) break;
    kept.unshift(m);
  }
  return kept;
}
