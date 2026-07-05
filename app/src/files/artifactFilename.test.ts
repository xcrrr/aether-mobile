import {
  sanitizeTitle,
  formatDate,
  buildArtifactFilename,
  resolveCollision,
} from './artifactFilename';

describe('artifact filename', () => {
  it('builds the canonical pattern', () => {
    const name = buildArtifactFilename('Weekly Plan', new Date('2026-07-05T10:00:00Z'));
    expect(name).toBe('Aether - Weekly Plan - 2026-07-05.pdf');
  });

  it('strips characters illegal on Android/SAF', () => {
    expect(sanitizeTitle('a/b\\c:d*e?f"g<h>i|j')).toBe('a b c d e f g h i j');
  });

  it('preserves Polish diacritics', () => {
    expect(sanitizeTitle('Zażółć gęślą')).toBe('Zażółć gęślą');
  });

  it('never exposes an empty name', () => {
    expect(sanitizeTitle('   ///   ')).toBe('Artifact');
  });

  it('bounds very long titles', () => {
    const long = 'x'.repeat(200);
    expect(sanitizeTitle(long).length).toBeLessThanOrEqual(60);
  });

  it('zero-pads the date', () => {
    expect(formatDate(new Date('2026-01-09T00:00:00Z'))).toBe('2026-01-09');
  });

  it('resolves collisions with incremental suffixes', async () => {
    const taken = new Set(['Aether - X - 2026-07-05.pdf', 'Aether - X - 2026-07-05 (2).pdf']);
    const out = await resolveCollision('Aether - X - 2026-07-05.pdf', (n) => taken.has(n));
    expect(out).toBe('Aether - X - 2026-07-05 (3).pdf');
  });

  it('returns the name unchanged when free', async () => {
    const out = await resolveCollision('Aether - Y - 2026-07-05.pdf', () => false);
    expect(out).toBe('Aether - Y - 2026-07-05.pdf');
  });
});
