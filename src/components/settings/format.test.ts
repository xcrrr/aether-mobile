import { formatBytes } from './format';

describe('formatBytes', () => {
  it('formats GB', () => expect(formatBytes(3462678272)).toBe('3.5 GB'));
  it('formats MB', () => expect(formatBytes(5_000_000)).toBe('5.0 MB'));
  it('formats KB', () => expect(formatBytes(2048)).toBe('2 KB'));
});
