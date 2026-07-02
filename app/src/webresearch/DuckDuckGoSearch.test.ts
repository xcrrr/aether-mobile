/**
 * Parses the html.duckduckgo.com results page. DDG wraps every outbound link in
 * a `/l/?uddg=<encoded real url>` redirect; we must unwrap it to the real URL,
 * decode the title/snippet, drop DDG-internal links, and never return unsafe
 * (SSRF / non-http) targets.
 */
import { parseSearchHtml, searchDuckDuckGo } from './DuckDuckGoSearch';

const RESULT = (uddg: string, title: string, snippet: string) => `
<div class="result results_links results_links_deep web-result">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=${uddg}&amp;rut=xyz">${title}</a>
  </h2>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=${uddg}">${snippet}</a>
  <div class="result__url">example.com</div>
</div>`;

const PAGE =
  RESULT(encodeURIComponent('https://en.wikipedia.org/wiki/Cat'), 'About <b>Cats</b>', 'The <b>cat</b> is a domestic species.') +
  RESULT(encodeURIComponent('https://www.aspca.org/cats'), 'ASPCA &amp; Cats', 'Cat care &amp; advice.');

describe('parseSearchHtml', () => {
  it('unwraps the uddg redirect to the real URL', () => {
    const r = parseSearchHtml(PAGE, 5);
    expect(r[0].url).toBe('https://en.wikipedia.org/wiki/Cat');
    expect(r[1].url).toBe('https://www.aspca.org/cats');
  });
  it('decodes and de-tags titles and snippets', () => {
    const r = parseSearchHtml(PAGE, 5);
    expect(r[0].title).toBe('About Cats');
    expect(r[0].snippet).toBe('The cat is a domestic species.');
    expect(r[1].title).toBe('ASPCA & Cats');
    expect(r[1].snippet).toBe('Cat care & advice.');
  });
  it('respects maxResults', () => {
    expect(parseSearchHtml(PAGE, 1)).toHaveLength(1);
  });
  it('drops results whose real URL is unsafe (SSRF / non-http)', () => {
    const bad =
      RESULT(encodeURIComponent('http://127.0.0.1/admin'), 'Local', 'snippet') +
      RESULT(encodeURIComponent('file:///etc/passwd'), 'File', 'snippet') +
      RESULT(encodeURIComponent('https://good.com/ok'), 'Good', 'snippet');
    const r = parseSearchHtml(bad, 5);
    expect(r).toHaveLength(1);
    expect(r[0].url).toBe('https://good.com/ok');
  });
  it('drops DuckDuckGo-internal links that are not real redirects', () => {
    const internal = `
      <h2 class="result__title">
        <a class="result__a" href="//duckduckgo.com/y.js?ad=1">Sponsored</a>
      </h2>`;
    expect(parseSearchHtml(internal, 5)).toHaveLength(0);
  });
  it('returns [] for an empty or resultless page', () => {
    expect(parseSearchHtml('<html><body>nothing</body></html>', 5)).toEqual([]);
  });
});

describe('searchDuckDuckGo', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('GETs the html endpoint with a desktop UA and parses the body', async () => {
    const fetchMock = jest.fn(async (_url: string, _opts?: unknown) => ({ ok: true, text: async () => PAGE }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const results = await searchDuckDuckGo('cats', 5);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('https://html.duckduckgo.com/html/?q=cats');
    expect((opts as { headers: Record<string, string> }).headers['User-Agent']).toMatch(/Mozilla/);
    expect(results[0].url).toBe('https://en.wikipedia.org/wiki/Cat');
  });

  it('returns [] when the request fails (never throws)', async () => {
    global.fetch = (jest.fn(async () => { throw new Error('network down'); })) as unknown as typeof fetch;
    await expect(searchDuckDuckGo('cats', 5)).resolves.toEqual([]);
  });

  it('url-encodes the query', async () => {
    const fetchMock = jest.fn(async (_url: string, _opts?: unknown) => ({ ok: true, text: async () => '' }));
    global.fetch = fetchMock as unknown as typeof fetch;
    await searchDuckDuckGo('c++ & rust', 5);
    expect(fetchMock.mock.calls[0][0]).toContain(encodeURIComponent('c++ & rust'));
  });
});
