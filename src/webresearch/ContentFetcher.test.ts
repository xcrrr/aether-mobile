/**
 * Fetches a single source page and reduces it to clean, capped plain text.
 * Must: refuse unsafe URLs before any request, only accept HTML/text bodies,
 * cap content length, and never throw (returns content '' on any failure).
 */
import { fetchAndClean } from './ContentFetcher';
import { MAX_CONTENT_CHARS } from './safety';

const htmlResponse = (body: string, type = 'text/html', url = 'https://example.com/x') => ({
  ok: true,
  url,
  headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? type : null) },
  text: async () => body,
});

describe('fetchAndClean', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('refuses an unsafe URL without making a request', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const src = await fetchAndClean('http://127.0.0.1/secret');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(src.content).toBe('');
    expect(src.url).toBe('http://127.0.0.1/secret');
  });

  it('fetches, extracts the title, and returns cleaned content', async () => {
    global.fetch = (jest.fn(async () =>
      htmlResponse('<html><head><title>Cats</title></head><body><script>x()</script><p>Cats purr.</p></body></html>'),
    )) as unknown as typeof fetch;
    const src = await fetchAndClean('https://example.com/cats');
    expect(src.title).toBe('Cats');
    expect(src.content).toBe('Cats purr.');
    expect(src.fetchedAt).toBeGreaterThan(0);
  });

  it('caps content at MAX_CONTENT_CHARS', async () => {
    const big = '<p>' + 'word '.repeat(5000) + '</p>';
    global.fetch = (jest.fn(async () => htmlResponse(big))) as unknown as typeof fetch;
    const src = await fetchAndClean('https://example.com/big');
    expect(src.content.length).toBeLessThanOrEqual(MAX_CONTENT_CHARS);
  });

  it('rejects non-text content types (e.g. binary) with empty content', async () => {
    global.fetch = (jest.fn(async () => htmlResponse('PNGDATA', 'image/png'))) as unknown as typeof fetch;
    const src = await fetchAndClean('https://example.com/img.png');
    expect(src.content).toBe('');
  });

  it('blocks a redirect that lands on a private/SSRF host (checks the final URL)', async () => {
    global.fetch = (jest.fn(async () =>
      htmlResponse('<p>internal</p>', 'text/html', 'http://169.254.169.254/latest/meta-data/'),
    )) as unknown as typeof fetch;
    const src = await fetchAndClean('https://public.com/redirector');
    expect(src.content).toBe('');
  });

  it('returns empty content (never throws) on network failure', async () => {
    global.fetch = (jest.fn(async () => { throw new Error('boom'); })) as unknown as typeof fetch;
    const src = await fetchAndClean('https://example.com/x');
    expect(src.content).toBe('');
  });

  it('returns empty content on a non-ok response', async () => {
    global.fetch = (jest.fn(async () => ({ ok: false, status: 404, headers: { get: () => 'text/html' }, text: async () => '' }))) as unknown as typeof fetch;
    const src = await fetchAndClean('https://example.com/missing');
    expect(src.content).toBe('');
  });
});
