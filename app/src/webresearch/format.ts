/**
 * Render a ResearchResult as chat markdown: the cited answer, then a numbered
 * source list whose indices line up with the inline [n] citations.
 */
import { ResearchResult } from './types';

export function formatResearchMarkdown(result: ResearchResult): string {
  if (result.sources.length === 0) return result.answer;
  const list = result.sources
    .map((s, i) => `${i + 1}. [${s.title || s.url}](${s.url})`)
    .join('\n');
  return `${result.answer}\n\n---\n\n**Sources**\n${list}`;
}
