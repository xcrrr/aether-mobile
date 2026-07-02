import { getPermissionExplanation, PERMISSION_EXPLANATIONS } from './explanations';

describe('permission explanations', () => {
  it('defines user-facing copy for sensitive runtime permissions', () => {
    expect(Object.keys(PERMISSION_EXPLANATIONS).sort()).toEqual([
      'camera',
      'files',
      'microphone',
      'notifications',
      'photo-library',
    ]);
  });

  it('explains microphone use before voice input can request permission', () => {
    const copy = getPermissionExplanation('microphone');
    expect(copy.title).toContain('Voice');
    expect(copy.message).toContain('tap Voice');
  });

  it('explains that model download notifications are tied to user-started downloads', () => {
    const copy = getPermissionExplanation('notifications');
    expect(copy.message).toContain('start a download');
  });
});

