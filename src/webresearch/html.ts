/**
 * Pure HTML → plain-text helpers for web research.
 *
 * Input is fully attacker-controlled, so every regex here is linear-time: each
 * uses mutually-exclusive character classes (`[^<]`, `[\s\S]*?`) that cannot
 * backtrack catastrophically. No nested quantifiers over overlapping classes.
 */
import { sanitizeModelText } from './safety';

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&apos;': "'", '&#39;': "'", '&#x27;': "'", '&#x2F;': '/',
  '&nbsp;': ' ',
};

/** Decode the handful of HTML entities common in page text. */
export function decodeEntities(text: string): string {
  let out = text;
  for (const [k, v] of Object.entries(ENTITIES)) out = out.split(k).join(v);
  // Generic numeric entities (decimal + hex), bounded digit counts.
  out = out.replace(/&#(\d{1,7});/g, (_, d) => safeCodePoint(parseInt(d, 10)));
  out = out.replace(/&#[xX]([0-9a-fA-F]{1,6});/g, (_, h) => safeCodePoint(parseInt(h, 16)));
  return out;
}

function safeCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return '';
  try { return String.fromCodePoint(cp); } catch { return ''; }
}

/** Pull the <title> text out, decoded and trimmed. '' when absent. */
export function extractTitle(html: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return '';
  return decodeEntities(m[1]).replace(/\s+/g, ' ').trim();
}

// Block-level chrome we never want as content.
const BLOCK_TAGS = ['head', 'script', 'style', 'noscript', 'nav', 'header', 'footer', 'svg', 'template', 'iframe'];
const BLOCK_RE = new RegExp(`<(${BLOCK_TAGS.join('|')})\\b[^>]*>[\\s\\S]*?<\\/\\1>`, 'gi');

/**
 * Strip tags in a single linear pass. A regex like `/<[^>]*>/g` is O(n²) on
 * pathological input (a long run of `<` with no `>` rescans from every position);
 * scanning with indexOf keeps it O(n). A `<` with no following `>` is treated as
 * literal text, not a tag.
 */
function stripTags(s: string): string {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf('<', i);
    if (lt === -1) { out += s.slice(i); break; }
    out += s.slice(i, lt);
    const gt = s.indexOf('>', lt + 1);
    if (gt === -1) { out += s.slice(lt); break; } // not a real tag — keep as text
    i = gt + 1;
  }
  return out;
}

/**
 * Strip a page down to readable plain text: drop comments + chrome blocks,
 * remove remaining tags, decode entities, collapse whitespace, and finally
 * scrub any model control tokens the page may have embedded.
 */
export function cleanHtml(html: string): string {
  let out = html;
  out = out.replace(/<!--[\s\S]*?-->/g, ' ');     // comments
  out = out.replace(BLOCK_RE, ' ');               // script/style/nav/header/footer/…
  out = stripTags(out);                           // any remaining tags (linear)
  out = decodeEntities(out);
  out = out.replace(/\s+/g, ' ').trim();          // collapse whitespace
  return sanitizeModelText(out);                  // prompt-injection guard
}
