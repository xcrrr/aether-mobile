import { MODELS, getModelById, DEFAULT_MODEL_ID } from './registry';

describe('model registry', () => {
  it('has exactly the two Gemma 4 models', () => {
    expect(MODELS.map((m) => m.id).sort()).toEqual(['gemma4-e2b', 'gemma4-e4b']);
  });
  it('default model is E2B (safe on 8GB)', () => {
    expect(DEFAULT_MODEL_ID).toBe('gemma4-e2b');
  });
  it('every model URL ends with its filename', () => {
    for (const m of MODELS) expect(m.downloadUrl.endsWith(m.filename)).toBe(true);
  });
  it('sizes are the verified byte counts', () => {
    expect(getModelById('gemma4-e2b')!.sizeBytes).toBe(3462678272);
    expect(getModelById('gemma4-e4b')!.sizeBytes).toBe(5405168384);
  });
  it('getModelById returns undefined for unknown ids', () => {
    expect(getModelById('nope')).toBeUndefined();
  });
});
