/**
 * Plain-text/markdown rendering of a research result.
 *
 * This is no longer what the chat screen displays — sources render as real cards
 * from `Message.research` — but it is still what the user gets when they copy a
 * research answer, where a numbered list is the right shape.
 */

interface FormattableResearch {
  answer: string;
  sources: { title: string; url: string }[];
}

export function formatResearchMarkdown(result: FormattableResearch): string {
  if (result.sources.length === 0) return result.answer;
  const list = result.sources
    .map((s, i) => `${i + 1}. ${s.title || s.url} — ${s.url}`)
    .join('\n');
  return `${result.answer}\n\nSources\n${list}`;
}
