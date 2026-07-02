/**
 * Mechanical grounding for Second Brain facts. A fact may only be saved when
 * the model's supporting quote actually appears in what the USER typed — so
 * assistant hallucinations and extractor inventions can never become memories,
 * regardless of how confident the model claims to be.
 */

const MIN_QUOTE_CHARS = 8;
const MIN_CONTAINMENT = 0.8;

/** Lowercase, strip punctuation, collapse whitespace — tolerant of typography. */
export function normalizeForGrounding(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’‘"”“´`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * How well `quote` is grounded in `userText` (both raw). Returns:
 *  - 1 when the normalized quote is a substring of the normalized user text
 *  - the token-containment ratio when ≥ {@link MIN_CONTAINMENT} (minor paraphrase)
 *  - 0 otherwise, or when the quote is too short to be meaningful evidence
 */
export function groundingScore(quote: string, userText: string): number {
  const q = normalizeForGrounding(quote);
  if (q.length < MIN_QUOTE_CHARS) return 0;
  const u = normalizeForGrounding(userText);
  if (!u) return 0;
  if (u.includes(q)) return 1;

  const quoteTokens = q.split(' ');
  if (quoteTokens.length < 2) return 0;
  const userTokens = new Set(u.split(' '));
  let present = 0;
  for (const t of quoteTokens) if (userTokens.has(t)) present += 1;
  const ratio = present / quoteTokens.length;
  return ratio >= MIN_CONTAINMENT ? ratio : 0;
}
