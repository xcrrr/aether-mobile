import { hasGgufMagic, isMmprojFileValid } from './ggufCheck';

describe('ggufCheck', () => {
  it('accepts the GGUF magic header (bytes 0x47475546)', () => {
    expect(hasGgufMagic('GGUF...rest')).toBe(true);
  });
  it('rejects an HTML error page saved as .gguf', () => {
    expect(hasGgufMagic('<!DOCTYPE html><html>404')).toBe(false);
  });
  it('rejects empty content', () => {
    expect(hasGgufMagic('')).toBe(false);
  });
  it('validates when magic present and size within 2% of expected', () => {
    expect(isMmprojFileValid({ headStr: 'GGUF', sizeBytes: 990_000_000, expectedBytes: 990_372_352 })).toBe(true);
  });
  it('invalidates a truncated file even with correct magic', () => {
    expect(isMmprojFileValid({ headStr: 'GGUF', sizeBytes: 12_000, expectedBytes: 990_372_352 })).toBe(false);
  });
  it('invalidates wrong magic regardless of size', () => {
    expect(isMmprojFileValid({ headStr: '<htm', sizeBytes: 990_372_352, expectedBytes: 990_372_352 })).toBe(false);
  });
});
