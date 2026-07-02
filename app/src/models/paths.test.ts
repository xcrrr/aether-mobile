import { modelDestPath, stripFileUri, isVerifiedSize } from './paths';

describe('model paths', () => {
  it('builds a plain dest path under the models dir', () => {
    expect(modelDestPath('/data/user/0/app/files', 'm.gguf')).toBe('/data/user/0/app/files/models/m.gguf');
  });
  it('strips file:// for native model consumers', () => {
    expect(stripFileUri('file:///data/x')).toBe('/data/x');
    expect(stripFileUri('/data/x')).toBe('/data/x');
  });
  it('accepts a file within 1% of expected size', () => {
    expect(isVerifiedSize(99, 100)).toBe(true);
    expect(isVerifiedSize(80, 100)).toBe(false);
  });
});
