import { formatResearchMarkdown } from './format';

const base = {
  answer: 'Answer grounded in [1] and [2].',
  sources: [
    { url: 'https://a.com', title: 'Alpha' },
    { url: 'https://b.com', title: 'Beta' },
  ],
};

describe('formatResearchMarkdown', () => {
  it('renders the answer followed by a numbered sources list', () => {
    const md = formatResearchMarkdown(base);
    expect(md).toContain('Answer grounded in [1] and [2].');
    expect(md).toContain('Sources');
    expect(md).toContain('1. Alpha — https://a.com');
    expect(md).toContain('2. Beta — https://b.com');
  });
  it('omits the sources section when there are none', () => {
    expect(formatResearchMarkdown({ ...base, sources: [] })).toBe(base.answer);
  });
  it('falls back to the URL when a source has no title', () => {
    const md = formatResearchMarkdown({ ...base, sources: [{ url: 'https://c.com', title: '' }] });
    expect(md).toContain('1. https://c.com — https://c.com');
  });
});
