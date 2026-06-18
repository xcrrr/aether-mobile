import { MemoryEntry, MEMORY_CATEGORIES } from './types';

const MAX_ENTRIES = 40;

/**
 * Build the "memory" section of the system prompt from stored entries.
 *
 * Entries are ranked by reinforcement (then confidence), capped at the top
 * {@link MAX_ENTRIES}, and grouped by category. Returns `''` when there is
 * nothing to inject so callers can prepend unconditionally.
 */
export function buildMemorySystemPrompt(entries: MemoryEntry[]): string {
  if (!entries.length) return '';

  const top = [...entries]
    .sort((a, b) =>
      b.timesReinforced - a.timesReinforced || b.confidence - a.confidence,
    )
    .slice(0, MAX_ENTRIES);

  const lines: string[] = ['What you know about this person:'];

  for (const category of MEMORY_CATEGORIES) {
    const group = top.filter((e) => e.category === category);
    if (!group.length) continue;
    lines.push('', `[${category}]`);
    for (const e of group) lines.push(`${e.key}: ${e.value}`);
  }

  lines.push(
    '',
    'Use this knowledge naturally in your responses. Do not explicitly mention ' +
      'that you have a memory system unless asked. Refer to the user by their ' +
      'preferred name if known. Adapt your tone and depth to their personality.',
  );

  return lines.join('\n');
}
