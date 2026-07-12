import { markdownToHtml, escapeHtml } from './markdownHtml';

describe('markdownToHtml', () => {
  it('renders headings by level', () => {
    expect(markdownToHtml('# Title')).toContain('<h1>Title</h1>');
    expect(markdownToHtml('### Sub')).toContain('<h3>Sub</h3>');
  });

  it('renders bold and italic inline', () => {
    expect(markdownToHtml('a **b** c')).toContain('<strong>b</strong>');
    expect(markdownToHtml('a *b* c')).toContain('<em>b</em>');
  });

  it('renders unordered and ordered lists', () => {
    const ul = markdownToHtml('- one\n- two');
    expect(ul).toContain('<ul>');
    expect(ul).toContain('<li>one</li>');
    const ol = markdownToHtml('1. a\n2. b');
    expect(ol).toContain('<ol>');
    expect(ol).toContain('<li>a</li>');
  });

  it('renders fenced code without transforming its contents', () => {
    const html = markdownToHtml('```\n**not bold**\n```');
    expect(html).toContain('<pre><code>**not bold**</code></pre>');
    expect(html).not.toContain('<strong>');
  });

  it('escapes HTML so artifact text cannot inject markup', () => {
    const html = markdownToHtml('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('drops non-http link protocols but keeps the text', () => {
    const html = markdownToHtml('[x](javascript:alert(1))');
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('x');
    expect(markdownToHtml('[y](https://a.com)')).toContain('href="https://a.com"');
  });

  it('preserves non-ASCII / Polish characters', () => {
    expect(markdownToHtml('Zażółć gęślą jaźń')).toContain('Zażółć gęślą jaźń');
  });

  it('escapeHtml handles all reserved characters', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
});
