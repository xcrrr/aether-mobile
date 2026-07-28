/**
 * Fetch one source page and reduce it to clean, length-capped plain text.
 *
 * Defence in depth: the URL is re-validated here (never trust the caller), the
 * request is time-boxed, only text/HTML bodies are parsed, the raw body is size-
 * capped before regex work, and any failure yields an empty-content source
 * rather than throwing — a dead source is simply skipped downstream.
 */
import { FetchedSource } from './types';
import { cleanHtml, extractTitle } from './html';
import {
  isSafeFetchUrl, clampChars, MAX_CONTENT_CHARS, MAX_HTML_BYTES, PAGE_TIMEOUT_MS, USER_AGENT,
} from './safety';

function empty(url: string): FetchedSource {
  return { url, title: '', content: '', fetchedAt: Date.now() };
}

export async function fetchAndClean(url: string): Promise<FetchedSource> {
  // Re-check at the boundary — caller-provided URLs are not to be trusted.
  if (!isSafeFetchUrl(url)) return empty(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,text/plain' },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) return empty(url);

    // A redirect can send a public URL to a private/SSRF host — re-validate the
    // final URL fetch actually landed on.
    if (res.url && !isSafeFetchUrl(res.url)) return empty(url);

    // Only parse textual bodies — skip images, PDFs, binaries, etc.
    const ctype = (res.headers?.get?.('content-type') ?? '').toLowerCase();
    if (ctype && !/text\/html|text\/plain|application\/xhtml/.test(ctype)) return empty(url);

    let body = await res.text();
    if (body.length > MAX_HTML_BYTES) body = body.slice(0, MAX_HTML_BYTES);

    const title = extractTitle(body);
    const content = clampChars(cleanHtml(body), MAX_CONTENT_CHARS);
    return { url, title, content, fetchedAt: Date.now() };
  } catch {
    return empty(url);
  } finally {
    clearTimeout(timer);
  }
}
