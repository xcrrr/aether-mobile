import { Message } from '@/types';

export interface AetherQuestion {
  question: string;
  options: string[];
}

export type Segment =
  | { type: 'text'; content: string }
  | { type: 'copy'; content: string; pending?: boolean }
  | { type: 'code'; content: string; lang?: string; pending?: boolean };

/** A finalized assistant message: renderable prose + an optional structured question. */
export interface FinalizedMessage {
  content: string;
  question?: AetherQuestion;
}

const MARKER = '__aether_question';
const COPY_OPEN = '<copy>';
const COPY_CLOSE = '</copy>';
const FENCE = '```';

export interface StreamedAssistantText {
  /** Text safe to place in the visible assistant message while generation runs. */
  content: string;
  /** Set as soon as a complete question payload has streamed. */
  question?: AetherQuestion;
  /** True when a hidden protocol prefix/payload is still streaming. */
  holding: boolean;
}

/** Gemma sometimes emits near-miss JSON; forgive trailing commas before giving up. */
function parseJsonTolerant(slice: string): unknown {
  try {
    return JSON.parse(slice);
  } catch {
    try {
      return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      return null;
    }
  }
}

function validateQuestion(obj: unknown): AetherQuestion | null {
  if (!obj || typeof obj !== 'object') return null;
  const q = obj as Record<string, unknown>;
  const flagged = q[MARKER] === true || q[MARKER] === 'true';
  if (!flagged || typeof q.question !== 'string' || !Array.isArray(q.options)) return null;
  const options = q.options.filter((o): o is string => typeof o === 'string' && !!o.trim());
  return options.length ? { question: q.question, options } : null;
}

/**
 * Detect a Claude-style elicitation block in an assistant message:
 *   { "__aether_question": true, "question": "...", "options": [...] }
 * Tolerant of surrounding prose and ```json fences. Returns null until the
 * JSON actually parses (so streaming partials don't false-positive).
 */
export function parseQuestion(text: string): AetherQuestion | null {
  return extractQuestion(text)?.question ?? null;
}

/**
 * Like parseQuestion, but also returns the prose surrounding the JSON block so
 * an answer the model streamed before/after the question is never discarded.
 */
export function extractQuestion(text: string): { question: AetherQuestion; prose: string } | null {
  const markerIdx = text.indexOf(MARKER);
  if (markerIdx === -1) return null;
  const start = text.lastIndexOf('{', markerIdx);
  if (start === -1) return null;
  // Try successive closing braces: robust against braces inside option strings
  // without needing a stateful JSON scanner.
  let end = text.indexOf('}', markerIdx);
  while (end !== -1) {
    const question = validateQuestion(parseJsonTolerant(text.slice(start, end + 1)));
    if (question) {
      const prose = stripEmptyFences(text.slice(0, start) + text.slice(end + 1)).trim();
      return { question, prose };
    }
    end = text.indexOf('}', end + 1);
  }
  return null;
}

/** Remove ```json fences left dangling once their JSON body was cut out. */
function stripEmptyFences(text: string): string {
  return text.replace(/```(?:json)?\s*```/g, '').replace(/```(?:json)?\s*$/g, '');
}

/** Pull a human-readable question out of malformed/truncated question JSON. */
function salvageQuestionText(text: string): string | null {
  const m = /"question"\s*:\s*"((?:[^"\\]|\\.)*)"?/.exec(text);
  if (!m || !m[1].trim()) return null;
  return m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim();
}

/** Cut the (possibly unterminated) question JSON region out of the text. */
function stripQuestionJson(text: string): string {
  const markerIdx = text.indexOf(MARKER);
  if (markerIdx === -1) return text;
  const start = text.lastIndexOf('{', markerIdx);
  if (start === -1) return text;
  const end = text.lastIndexOf('}');
  const after = end > markerIdx ? text.slice(end + 1) : '';
  return stripEmptyFences(text.slice(0, start) + after).trim();
}

const QUESTION_OPENERS = [
  `{"${MARKER}"`,
  `{ "${MARKER}"`,
  `{\n"${MARKER}"`,
  `{\n  "${MARKER}"`,
  `\`\`\`json\n{"${MARKER}"`,
  `\`\`\`json\n{ "${MARKER}"`,
  `\`\`\`\n{"${MARKER}"`,
  `\`\`\`\n{ "${MARKER}"`,
];

function pendingPrefixStart(text: string, openers: string[]): number | null {
  const max = Math.min(text.length, Math.max(...openers.map((o) => o.length)) - 1);
  for (let len = max; len > 0; len--) {
    const suffix = text.slice(-len);
    if (openers.some((o) => o.startsWith(suffix) && suffix !== o)) return text.length - len;
  }
  return null;
}

function hideTrailingProtocolPrefix(text: string): { content: string; holding: boolean } {
  if (text.endsWith(FENCE)) return { content: text, holding: false };
  const start = pendingPrefixStart(text, [COPY_OPEN, COPY_CLOSE, FENCE]);
  if (start == null) return { content: text, holding: false };
  return { content: text.slice(0, start), holding: true };
}

function hideQuestionDuringStream(text: string): StreamedAssistantText | null {
  const markerIdx = text.indexOf(MARKER);
  if (markerIdx !== -1) {
    const extracted = extractQuestion(text);
    if (extracted) {
      return { content: extracted.prose, question: extracted.question, holding: false };
    }
    const start = text.lastIndexOf('{', markerIdx);
    if (start !== -1) {
      return {
        content: stripEmptyFences(text.slice(0, start)).trimEnd(),
        holding: true,
      };
    }
  }

  const prefixStart = pendingPrefixStart(text, QUESTION_OPENERS);
  if (prefixStart != null) {
    const suffix = text.slice(prefixStart);
    if (suffix.startsWith(FENCE) && text.slice(0, prefixStart).includes(FENCE)) return null;
    return {
      content: text.slice(0, prefixStart).trimEnd(),
      holding: true,
    };
  }

  return null;
}

/**
 * Streaming projection for the in-progress assistant turn. It only hides exact
 * prefixes/payloads of Aether-owned protocols; ordinary JSON, HTML-ish text,
 * arrays, and code fences become visible as soon as they diverge from those
 * known protocol openers. This runs in the store on token arrival, not during
 * render, so the normal render path never reparses the full message.
 */
export function projectAssistantStream(raw: string): StreamedAssistantText {
  const question = hideQuestionDuringStream(raw);
  if (question) return question;
  const visible = hideTrailingProtocolPrefix(raw);
  return { content: visible.content, holding: visible.holding };
}

function finalizeVisibleCopyProtocol(text: string): string {
  let out = text;
  let changed = false;
  for (const partial of ['</copy', '</cop', '</co', '</c', '</', '<copy', '<cop', '<co', '<c', '<']) {
    if (out.endsWith(partial)) {
      out = out.slice(0, -partial.length);
      changed = true;
      break;
    }
  }
  const openIdx = out.lastIndexOf(COPY_OPEN);
  const closeIdx = out.lastIndexOf(COPY_CLOSE);
  if (openIdx > closeIdx) {
    const before = out.slice(0, openIdx);
    let after = out.slice(openIdx + COPY_OPEN.length);
    if (before.endsWith('\n') && after.startsWith('\n')) after = after.slice(1);
    out = before + after;
    changed = true;
  }
  return changed ? out.trim() : out;
}

function copyProtocolHistoryText(text: string): string {
  let out = text.replace(/<copy>([\s\S]*?)<\/copy>/g, (_m, body: string) => body.trim());
  out = finalizeVisibleCopyProtocol(out);
  return out.trim();
}

/**
 * Deterministic normalization run at every terminal transition (finish, stop,
 * error) and as a legacy fallback at render. Guarantees the result is always
 * renderable: a valid question becomes structured data (prose preserved),
 * malformed question JSON is salvaged into a plain-text question, and leftover
 * JSON junk never reaches the screen.
 */
export function finalizeAssistantText(raw: string): FinalizedMessage {
  if (!raw.includes(MARKER)) return { content: finalizeVisibleCopyProtocol(raw) };
  const extracted = extractQuestion(raw);
  if (extracted) return { content: finalizeVisibleCopyProtocol(extracted.prose), question: extracted.question };
  const prose = finalizeVisibleCopyProtocol(stripQuestionJson(raw));
  const salvaged = salvageQuestionText(raw);
  const content = [prose, salvaged].filter(Boolean).join('\n\n').trim();
  return { content };
}

const BLOCK_RE = /<copy>([\s\S]*?)<\/copy>|```([^\n`]*)\n?([\s\S]*?)```/g;

/**
 * Split an assistant message into ordered segments: prose (markdown), <copy>
 * deliverables (verbatim), and fenced code. Used to give copy blocks and code
 * their own copyable card treatment while everything else renders as markdown.
 *
 * With `streaming: true`, a trailing unclosed <copy> tag or ``` fence becomes a
 * `pending` block segment, so the card appears the moment the block opens and
 * fills in live instead of flashing raw markup that later turns into a card.
 */
export function segmentMessage(text: string, opts: { streaming?: boolean } = {}): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  BLOCK_RE.lastIndex = 0;
  while ((m = BLOCK_RE.exec(text)) !== null) {
    const between = text.slice(last, m.index).trim();
    if (between) segments.push({ type: 'text', content: between });
    if (m[1] !== undefined) {
      segments.push({ type: 'copy', content: m[1].trim() });
    } else {
      const lang = m[2].trim();
      segments.push({ type: 'code', content: m[3].replace(/\n$/, ''), ...(lang ? { lang } : {}) });
    }
    last = BLOCK_RE.lastIndex;
  }
  let tail = text.slice(last);
  if (opts.streaming) {
    const pending = pendingBlock(tail);
    if (pending) {
      const before = tail.slice(0, pending.start).trim();
      if (before) segments.push({ type: 'text', content: before });
      segments.push(pending.segment);
      tail = '';
    }
  }
  const rest = tail.trim();
  if (rest) segments.push({ type: 'text', content: rest });
  if (segments.length === 0) segments.push({ type: 'text', content: text.trim() });
  return segments;
}

/** Find a trailing unclosed <copy> or ``` fence in already-blockless text. */
function pendingBlock(tail: string): { start: number; segment: Segment } | null {
  const copyIdx = tail.lastIndexOf('<copy>');
  const fenceIdx = tail.lastIndexOf('```');
  if (copyIdx === -1 && fenceIdx === -1) return null;
  if (copyIdx > fenceIdx) {
    const content = tail.slice(copyIdx + '<copy>'.length).replace(/^\n/, '');
    return { start: copyIdx, segment: { type: 'copy', content, pending: true } };
  }
  const afterFence = tail.slice(fenceIdx + 3);
  const nl = afterFence.indexOf('\n');
  const lang = (nl === -1 ? afterFence : afterFence.slice(0, nl)).trim();
  const content = nl === -1 ? '' : afterFence.slice(nl + 1);
  return {
    start: fenceIdx,
    segment: { type: 'code', content, ...(lang ? { lang } : {}), pending: true },
  };
}

/** Natural-language form of a question for model history (never raw JSON). */
export function questionHistoryText(q: AetherQuestion): string {
  return `${q.question} (options: ${q.options.join(' / ')})`;
}

/**
 * The text a message contributes to the model's conversation history. Question
 * turns are rewritten as natural language so the model (a) understands what the
 * user's short answer refers to and (b) is never shown its own JSON back, which
 * would teach it to keep emitting JSON and to re-ask.
 */
export function messageModelText(m: Message): string {
  if (m.role !== 'assistant') return m.content;
  if (m.question) {
    return [copyProtocolHistoryText(m.content), questionHistoryText(m.question)].filter(Boolean).join('\n\n');
  }
  if (m.content.includes(MARKER)) {
    const fin = finalizeAssistantText(m.content);
    return fin.question
      ? [fin.content, questionHistoryText(fin.question)].filter(Boolean).join('\n\n')
      : fin.content;
  }
  return copyProtocolHistoryText(m.content);
}

/** Loose equality for "is this the same question again?" duplicate demotion. */
export function sameQuestion(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return norm(a) === norm(b) && norm(a).length > 0;
}
