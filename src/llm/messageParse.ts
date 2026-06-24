export interface AetherQuestion {
  question: string;
  options: string[];
}

export type Segment =
  | { type: 'text'; content: string }
  | { type: 'copy'; content: string }
  | { type: 'code'; content: string; lang?: string };

/**
 * Detect a Claude-style elicitation block in an assistant message:
 *   { "__aether_question": true, "question": "...", "options": [...] }
 * Tolerant of surrounding prose and ```json fences. Returns null until the
 * JSON actually parses (so streaming partials don't false-positive).
 */
export function parseQuestion(text: string): AetherQuestion | null {
  if (!text.includes('__aether_question')) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    if (
      obj && obj.__aether_question === true &&
      typeof obj.question === 'string' && Array.isArray(obj.options)
    ) {
      const options = obj.options.filter((o: unknown): o is string => typeof o === 'string');
      if (options.length) return { question: obj.question, options };
    }
  } catch {
    // Partial/invalid JSON — treat as not-a-question.
  }
  return null;
}

const BLOCK_RE = /<copy>([\s\S]*?)<\/copy>|```([^\n`]*)\n?([\s\S]*?)```/g;

/**
 * Split an assistant message into ordered segments: prose (markdown), <copy>
 * deliverables (verbatim), and fenced code. Used to give copy blocks and code
 * their own copyable card treatment while everything else renders as markdown.
 */
export function segmentMessage(text: string): Segment[] {
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
  const tail = text.slice(last).trim();
  if (tail) segments.push({ type: 'text', content: tail });
  if (segments.length === 0) segments.push({ type: 'text', content: text.trim() });
  return segments;
}
