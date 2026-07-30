/**
 * Mechanical grounding for Second Brain facts. A fact may only be saved when
 * the model's supporting quote actually appears in what the USER typed — so
 * assistant hallucinations and extractor inventions can never become memories,
 * regardless of how confident the model claims to be.
 */

const MIN_QUOTE_CHARS = 8;

/** Lowercase, strip punctuation, collapse whitespace — tolerant of typography. */
export function normalizeForGrounding(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’‘"”“´`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * How well `quote` is grounded in `userText` (both raw). A quote is evidence only
 * when its normalized words appear contiguously in one user message. Reordered
 * bag-of-words containment is not verbatim evidence and must not pass.
 */
export function groundingScore(quote: string, userText: string): number {
  const q = normalizeForGrounding(quote);
  if (q.length < MIN_QUOTE_CHARS) return 0;
  const u = normalizeForGrounding(userText);
  if (!u) return 0;
  return ` ${u} `.includes(` ${q} `) ? 1 : 0;
}
