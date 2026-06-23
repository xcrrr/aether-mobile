import { deriveVisionStatus } from './visionStatus';

describe('deriveVisionStatus', () => {
  it('not-supported when the model has no vision', () => {
    expect(deriveVisionStatus({ supported: false, installed: false, ready: false, selfTestPassed: false, error: null }).kind)
      .toBe('unsupported');
  });
  it('not-downloaded when supported but pack absent', () => {
    expect(deriveVisionStatus({ supported: true, installed: false, ready: false, selfTestPassed: false, error: null }).kind)
      .toBe('not_downloaded');
  });
  it('verifying when installed + ready but self-test not done yet', () => {
    expect(deriveVisionStatus({ supported: true, installed: true, ready: true, selfTestPassed: false, error: null }).kind)
      .toBe('verifying');
  });
  it('working when self-test passed', () => {
    expect(deriveVisionStatus({ supported: true, installed: true, ready: true, selfTestPassed: true, error: null }).kind)
      .toBe('working');
  });
  it('error surfaces the failure string when ready failed', () => {
    const s = deriveVisionStatus({ supported: true, installed: true, ready: false, selfTestPassed: false, error: 'clip init failed' });
    expect(s.kind).toBe('error');
    expect(s.detail).toBe('clip init failed');
  });
});
