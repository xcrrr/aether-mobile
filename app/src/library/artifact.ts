import { AgentArtifact, ArtifactType } from '@/agent/types';

/**
 * Pure helpers over a saved artifact: kind inference, human title recovery,
 * filename sanitation, and a plain-text rendering of markdown content. No IO,
 * no storage — safe to unit test and reuse across export and UI.
 */

const TYPE_LABEL: Record<ArtifactType, string> = {
  document: 'Document',
  plan: 'Plan',
  report: 'Report',
  note: 'Note',
};

export function artifactType(a: Pick<AgentArtifact, 'type'>): ArtifactType {
  return a.type ?? 'document';
}

export function typeLabel(a: Pick<AgentArtifact, 'type'>): string {
  return TYPE_LABEL[artifactType(a)];
}

/** Best-effort kind from an existing title/content — never a network call. */
export function inferType(title: string, content: string): ArtifactType {
  const hay = `${title}\n${content.slice(0, 400)}`.toLowerCase();
  if (/\b(plan|roadmap|itinerary|schedule|checklist|steps?)\b/.test(hay)) return 'plan';
  if (/\b(report|analysis|summary|findings|overview|brief)\b/.test(hay)) return 'report';
  return 'document';
}

const GENERIC_TITLE = /^(untitled|artifact|document|draft)\b/i;

/**
 * A meaningful title for Library. Prefer an existing good title; otherwise
 * recover one from the first markdown heading or first non-empty line. Never
 * returns a raw multi-line prompt or an empty string.
 */
export function deriveTitle(title: string, content: string): string {
  const t = title.trim();
  if (t && !GENERIC_TITLE.test(t)) return clampTitle(t);

  const heading = content.match(/^#{1,3}\s+(.+)$/m);
  if (heading) return clampTitle(heading[1]);

  const firstLine = content
    .split('\n')
    .map((l) => l.replace(/^[#>*\-\s]+/, '').trim())
    .find((l) => l.length > 0);
  if (firstLine) return clampTitle(firstLine);

  return t || 'Untitled';
}

function clampTitle(s: string): string {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > 80 ? `${one.slice(0, 77)}…` : one;
}
