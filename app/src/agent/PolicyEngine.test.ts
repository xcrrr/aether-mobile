import { decide, budgetsFor, autoSavesArtifacts } from './PolicyEngine';
import { RiskClass } from './types';

describe('PolicyEngine.decide', () => {
  it('strict requires approval for every data-touching class', () => {
    expect(decide('strict', 'core_read')).toBe('approval');
    expect(decide('strict', 'local_read_scoped')).toBe('approval');
    expect(decide('strict', 'web_read')).toBe('approval');
    expect(decide('strict', 'artifact_draft')).toBe('approval');
  });

  it('strict lets the user-facing surfaces run (they ARE consent)', () => {
    expect(decide('strict', 'interaction')).toBe('auto');
    expect(decide('strict', 'terminal')).toBe('auto');
  });

  it('balanced auto-allows scoped reads and drafts', () => {
    expect(decide('balanced', 'core_read')).toBe('auto');
    expect(decide('balanced', 'local_read_scoped')).toBe('auto');
    expect(decide('balanced', 'web_read')).toBe('auto');
    expect(decide('balanced', 'artifact_draft')).toBe('auto');
  });

  it('auto never widens beyond the registered classes', () => {
    // Anything outside the closed RiskClass union is blocked even in auto.
    expect(decide('auto', 'external_write' as RiskClass)).toBe('blocked');
    expect(decide('auto', 'destructive' as RiskClass)).toBe('blocked');
    expect(decide('auto', 'shell' as RiskClass)).toBe('blocked');
  });

  it('unknown mode blocks everything', () => {
    expect(decide('yolo' as never, 'web_read')).toBe('blocked');
  });
});

describe('artifact persistence policy', () => {
  it('only auto mode saves artifacts without a user tap', () => {
    expect(autoSavesArtifacts('strict')).toBe(false);
    expect(autoSavesArtifacts('balanced')).toBe(false);
    expect(autoSavesArtifacts('auto')).toBe(true);
  });
});

describe('budgetsFor', () => {
  it('gives auto the widest budgets, strict the narrowest', () => {
    const s = budgetsFor('strict', 'gemma4-e4b');
    const b = budgetsFor('balanced', 'gemma4-e4b');
    const a = budgetsFor('auto', 'gemma4-e4b');
    expect(s.maxSteps).toBeLessThanOrEqual(b.maxSteps);
    expect(b.maxSteps).toBeLessThanOrEqual(a.maxSteps);
    expect(a.maxSteps).toBeLessThanOrEqual(8);
  });

  it('narrows E2B regardless of mode', () => {
    const a4 = budgetsFor('auto', 'gemma4-e4b');
    const a2 = budgetsFor('auto', 'gemma4-e2b');
    expect(a2.maxSteps).toBeLessThanOrEqual(5);
    expect(a2.maxSteps).toBeLessThanOrEqual(a4.maxSteps);
    expect(a2.maxWebResearch).toBeLessThanOrEqual(a4.maxWebResearch);
  });

  it('every mode has finite budgets', () => {
    for (const mode of ['strict', 'balanced', 'auto'] as const) {
      const b = budgetsFor(mode, null);
      expect(b.maxSteps).toBeGreaterThan(0);
      expect(b.maxModelCalls).toBeGreaterThan(0);
      expect(b.wallClockMs).toBeGreaterThan(0);
      expect(Number.isFinite(b.wallClockMs)).toBe(true);
    }
  });
});
