import { safeParse } from './json';

describe('safeParse', () => {
  it('parses valid JSON', () => {
    expect(safeParse('{"a":1}', { a: 0 })).toEqual({ a: 1 });
  });
  it('returns the fallback on null', () => {
    expect(safeParse(null, { a: 9 })).toEqual({ a: 9 });
  });
  it('returns the fallback on corrupt JSON', () => {
    expect(safeParse('{bad', { a: 9 })).toEqual({ a: 9 });
  });
});
