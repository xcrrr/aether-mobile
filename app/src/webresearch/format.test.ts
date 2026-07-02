import { formatResearchMarkdown } from './format';
import { ResearchResult } from './types';

const base: ResearchResult = {
  query: 'q',
  sources: [
    { url: 'https://a.com', title: 'Alpha', content: 'x', fetchedAt: 1 },
    { url: 'https://b.com', title: 'Beta', content: 'y', fetchedAt: 1 },
  ],
  answer: 'Answer grounded in [1] and [2].',
  citations: [
    { index: 1, url: 'https://a.com', title: 'Alpha' },
    { index: 2, url: 'https://b.com', title: 'Beta' },
  ],
};

describe('formatResearchMarkdown', () => {
  it('renders the answer followed by a numbered sources list', () => {
    const md = formatResearchMarkdown(base);
    expect(md).toContain('Answer grounded in [1] and [2].');
    expect(md).toContain('**Sources**');
    expect(md).toContain('1. [Alpha](https://a.com)');
    expect(md).toContain('2. [Beta](https://b.com)');
  });
  it('omits the sources section when there are none', () => {
    const md = formatResearchMarkdown({ ...base, sources: [], citations: [] });
    expect(md).not.toContain('**Sources**');
  });
  it('falls back to the URL when a source has no title', () => {
    const md = formatResearchMarkdown({
      ...base,
      sources: [{ url: 'https://c.com', title: '', content: 'z', fetchedAt: 1 }],
    });
    expect(md).toContain('1. [https://c.com](https://c.com)');
  });
});
