import { Message, UserProfile, FileAttachment } from '@/types';
import { buildMemorySystemPrompt } from '@/secondbrain/MemoryInjector';
import { RecallResult } from '@/secondbrain/recall';

/** Legacy Gemma media placeholder. LiteRT receives image bytes separately. */
const MEDIA_MARKER = '<__media__>';

// Deliberately minimal: like Google's AI Edge Gallery, which ships an EMPTY
// default system prompt and lets Gemma answer at its natural length. Earlier
// versions over-instructed length here and the model replied in clipped one-liners.
// Keep only identity + an honesty guard; let the model decide how long to be.
const BASE =
  'You are Aether, a private AI assistant running locally on the user\'s Android phone ' +
  'for regular chat after the model is loaded. Be warm, natural, and genuinely ' +
  'helpful, and answer at whatever length the question deserves: a quick question can ' +
  'get a quick answer, but give real, complete explanations when they help. ' +
  'Be truthful: never invent facts or claim to see something (like an image) you cannot. ' +
  'If you are unsure, say so rather than making things up.';

// How Aether interacts. The exact tokens here are parsed by messageParse.ts so
// the chat UI can render tappable option pills (__aether_question) and copy
// buttons (```fences``` / <copy>); keep the spelling exact.
const INTERACTION =
  'Aether has a few internal UI formats. In ordinary chat, do not emit JSON, XML-like ' +
  'tags, hidden control text, or copy-block wrappers unless one of the rules below ' +
  'specifically applies.\n' +
  'Clarifying questions: only ask one when a missing detail would materially change your ' +
  'answer (like the recipient or tone of an email, or what kind of website to build). Most ' +
  'requests need NO clarification: when a reasonable assumption works, answer directly and ' +
  'briefly state the assumption. To ask, your ENTIRE reply must be exactly this JSON object, ' +
  'with no other text before or after it:\n' +
  '{"__aether_question": true, "question": "<one short, plain question>", "options": ["<choice 1>", "<choice 2>", "<choice 3>"]}\n' +
  'Give 2-4 short, genuinely different options. If there are no natural choices, ask the ' +
  'question as ordinary text without the JSON. Never ask about something the user already ' +
  'told you, never repeat a question that was answered, never ask more than one clarifying ' +
  'question per task, and never mix a normal answer with the question JSON.\n' +
  'Copyable deliverables: when you produce something the user will take out of this chat and ' +
  'use as-is, such as code, a shell command, an email, a message, a caption, or a template, ' +
  'wrap it so it gets its own copy button: put code in a fenced ``` block tagged with its ' +
  'language, and any other copyable text inside a <copy> ... </copy> block. The block must ' +
  'contain ONLY the deliverable itself, exactly as it should be pasted. Never wrap ' +
  'explanations or ordinary prose this way.';

/** Human-readable local date/time line so Aether knows the real "now". */
function formatNow(d: Date): string {
  try {
    return d.toLocaleString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return d.toISOString();
  }
}

export interface PromptContext {
  /** Display name of the model currently loaded (e.g. "Gemma 4 E4B"). */
  modelName?: string;
  /** Override "now" for tests. Defaults to the real current time. */
  now?: Date;
  /** Core recall selected for this message (see secondbrain/recall.ts). */
  recall?: RecallResult;
}

export function buildSystemPrompt(profile: UserProfile | null, ctx: PromptContext = {}): string {
  const parts: string[] = [];

  parts.push(BASE);
  parts.push(INTERACTION);
  parts.push(`The current date and time is ${formatNow(ctx.now ?? new Date())} (the user's local time).`);
  if (ctx.modelName) {
    parts.push(
      `You are currently running as the ${ctx.modelName} model, on-device. If the user asks ` +
      `which model or AI they are, tell them: ${ctx.modelName}.`,
    );
  }
  if (profile?.name) parts.push(`The user's name is ${profile.name}. Use it sparingly — only when it feels natural, never in every reply.`);
  if (profile?.occupation) parts.push(`They work as ${profile.occupation}.`);
  if (profile?.project) parts.push(`They are working on: ${profile.project}.`);
  if (profile?.goals) parts.push(`They want help with: ${profile.goals}.`);
  if (profile?.language) parts.push(`Always reply in ${profile.language}.`);

  // Core notes go LAST: identity and behavior come first, remembered data after.
  if (ctx.recall) {
    const memory = buildMemorySystemPrompt(ctx.recall);
    if (memory) parts.push(memory);
  }
  return parts.join('\n\n');
}

const TYPE_LABEL: Record<FileAttachment['type'], string> = {
  image: 'image', pdf: 'PDF', text: 'text file', docx: 'Word document',
};

/**
 * Weave a message's non-image attachments (PDF/DOCX/text) into a document
 * context block: extracted text is quoted in full (already bounded by
 * FileProcessor's truncation), unreadable documents fall back to naming the
 * file and asking the user to paste the relevant text. Shared by every prompt
 * builder — including the live chat path in LiteRtService — so a document
 * only needs one formatting rule.
 */
export function buildDocumentContext(attachments: FileAttachment[]): string {
  const blocks: string[] = [];
  for (const a of attachments) {
    if (a.type === 'image') continue;
    if (a.extractedText) {
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
  return blocks.join('\n\n');
}

/**
 * Weave a user message's attachments into its text so the model sees them:
 *  - images get a short "analyze the attached image" preamble (the pixels are
 *    delivered separately through the multimodal API)
 *  - documents go through {@link buildDocumentContext}
 */
export function buildUserContent(message: Message, visionActive = false): string {
  const attachments = message.attachments ?? [];
  if (attachments.length === 0) return message.content;

  const blocks: string[] = [];
  const image = attachments.find((a) => a.type === 'image');
  if (image) {
    // Only claim the image is viewable when its pixels are actually being fed
    // to the active engine. The marker is kept for legacy prompt builders; the
    // LiteRT engine receives image bytes through the native API.
    blocks.push(visionActive
      ? `${MEDIA_MARKER}\nThe user shared this image. Describe and analyze ONLY what is actually visible in it. Do not invent anything you cannot see.`
      : 'The user attached an image, but image analysis is not available in this session, so you genuinely cannot see it. Tell the user you can\'t view the image right now and do NOT guess or make up what it shows.');
  }
  const docBlock = buildDocumentContext(attachments);
  if (docBlock) blocks.push(docBlock);

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
 * text. Native streaming can emit the first chars of a stop token before the stop
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
