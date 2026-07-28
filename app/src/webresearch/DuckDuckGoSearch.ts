/**
 * DuckDuckGo HTML-endpoint search.
 *
 * We hit `html.duckduckgo.com/html/` (no JS, no API key) and parse the result
 * list with linear-time regexes. Every outbound link is wrapped in a
 * `/l/?uddg=<encoded url>` redirect — we unwrap it to the real destination and
 * pass it through the SSRF/scheme safety gate before keeping it.
 */
import { SearchResponse, SearchResult } from './types';
import { decodeEntities } from './html';
import { isSafeFetchUrl, sanitizeModelText, USER_AGENT, FETCH_TIMEOUT_MS } from './safety';

const ENDPOINT = 'https://html.duckduckgo.com/html/?q=';

// Title link: <a ... class="result__a" ... href="...">title</a>
const RESULT_A = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
// Snippet:    <a ... class="result__snippet" ...>snippet</a>
const SNIPPET = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

/** Decode tags+entities from an inner HTML fragment into clean one-line text. */
function text(fragment: string): string {
  const noTags = fragment.replace(/<[^>]*>/g, '');
  return sanitizeModelText(decodeEntities(noTags)).replace(/\s+/g, ' ').trim();
}

/**
 * Resolve a DDG result href to its real destination, or null if it isn't a real
 * outbound link (ads, internal `y.js`, etc.). DDG uses `/l/?uddg=<encoded url>`.
 */
function resolveHref(href: string): string | null {
  const decoded = decodeEntities(href);
  const m = /[?&]uddg=([^&]+)/.exec(decoded);
  if (!m) return null;                 // not a real redirect (ad / internal)
  try {
    const real = decodeURIComponent(m[1]);
    return isSafeFetchUrl(real) ? real : null;
  } catch {
    return null;
  }
}

/** Find the snippet that follows a title at `fromIndex` (before the next one). */
function snippetAfter(html: string, fromIndex: number, nextTitleIndex: number): string {
  SNIPPET.lastIndex = fromIndex;
  const m = SNIPPET.exec(html);
  if (!m) return '';
  if (nextTitleIndex >= 0 && m.index > nextTitleIndex) return ''; // belongs to next result
  return text(m[1]);
}

/** Parse a DDG HTML results page into safe SearchResults (pure, testable). */
export function parseSearchHtml(html: string, maxResults: number): SearchResult[] {
  const titles: { url: string; title: string; index: number }[] = [];
  RESULT_A.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RESULT_A.exec(html)) !== null) {
    const url = resolveHref(m[1]);
    if (!url) continue;
    titles.push({ url, title: text(m[2]), index: m.index });
  }

  const out: SearchResult[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < titles.length && out.length < maxResults; i++) {
    const t = titles[i];
    if (seen.has(t.url)) continue;
    seen.add(t.url);
    const next = i + 1 < titles.length ? titles[i + 1].index : -1;
    out.push({ url: t.url, title: t.title, snippet: snippetAfter(html, t.index, next) });
  }
  return out;
}

/**
 * A shorter, plainer form of a query, used for one retry when the first attempt
 * finds nothing. Long natural-language questions and quoted phrases are the most
 * common reason DuckDuckGo returns an empty result list.
 */
export function simplifyQuery(query: string): string {
  const words = query
    .replace(/["'“”‘’]/g, ' ')
    .replace(/[?!.,;:]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, 10).join(' ');
}

/** One search request. Never throws; the status says why the list is empty. */
async function searchOnce(query: string, maxResults: number): Promise<SearchResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT + encodeURIComponent(query), {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: controller.signal,
    });
    // A non-OK status is the endpoint refusing us (rate limit, bot challenge) —
    // never the user's phrasing, and it must not be reported as one.
    if (!res.ok) return { results: [], status: 'blocked' };
    const body = await res.text();
    const results = parseSearchHtml(body, maxResults);
    return { results, status: results.length ? 'ok' : 'no-results' };
  } catch {
    return { results: [], status: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search DuckDuckGo. Never throws. An empty result list from a working endpoint
 * is retried once with a simplified query before it is reported as no-results,
 * because a long conversational question is the usual cause.
 */
export async function searchDuckDuckGo(query: string, maxResults = 5): Promise<SearchResponse> {
  const first = await searchOnce(query, maxResults);
  if (first.status !== 'no-results') return first;

  const simplified = simplifyQuery(query);
  if (!simplified || simplified === query.trim()) return first;
  const retry = await searchOnce(simplified, maxResults);
  return retry.status === 'ok' ? retry : first;
}
