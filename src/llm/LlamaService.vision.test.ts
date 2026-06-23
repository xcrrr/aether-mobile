jest.mock('llama.rn', () => ({ initLlama: jest.fn() }));
jest.mock('react-native-device-info', () => ({
  getTotalMemorySync: () => 16 * 1024 ** 3,
  getUsedMemorySync: () => 1 * 1024 ** 3,
}));
jest.mock('expo-asset', () => ({ Asset: { fromModule: jest.fn() } }));

import { __setVisionTestHooks, getVisionStatus, runVisionSelfTest, toNativeMediaPath } from './LlamaService';

describe('toNativeMediaPath', () => {
  it('strips a file:// scheme so native fopen gets a real path', () => {
    expect(toNativeMediaPath('file:///data/user/0/com.aether.app/cache/vision-1.jpg'))
      .toBe('/data/user/0/com.aether.app/cache/vision-1.jpg');
  });
  it('leaves a bare absolute path untouched', () => {
    expect(toNativeMediaPath('/data/cache/x.jpg')).toBe('/data/cache/x.jpg');
  });
  it('leaves a base64 data URI untouched (native decodes it from the buffer)', () => {
    expect(toNativeMediaPath('data:image/jpeg;base64,AAAA')).toBe('data:image/jpeg;base64,AAAA');
  });
});

describe('vision self-test', () => {
  afterEach(() => __setVisionTestHooks(null));

  it('marks vision working when a decode returns non-empty tokens', async () => {
    __setVisionTestHooks({
      multimodalReady: true,
      selfTestImagePath: '/tmp/red.png',
      completion: async (_p: unknown, onTok: (t: { token?: string }) => void) => { onTok({ token: 'red' }); },
    });
    const ok = await runVisionSelfTest();
    expect(ok).toBe(true);
    expect(getVisionStatus().selfTestPassed).toBe(true);
  });

  it('records an error and fails the self-test when decode throws', async () => {
    __setVisionTestHooks({
      multimodalReady: true,
      selfTestImagePath: '/tmp/red.png',
      completion: async () => { throw new Error('mtmd decode failed'); },
    });
    const ok = await runVisionSelfTest();
    expect(ok).toBe(false);
    expect(getVisionStatus().error).toMatch(/mtmd decode failed/);
  });
});
