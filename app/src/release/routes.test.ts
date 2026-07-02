import { canOpenRouteInBuild } from './routes';

describe('release route availability', () => {
  it('blocks the typography preview route outside dev builds', () => {
    expect(canOpenRouteInBuild('typography-preview', false)).toBe(false);
    expect(canOpenRouteInBuild('/(main)/typography-preview', false)).toBe(false);
  });

  it('allows normal routes in release builds', () => {
    expect(canOpenRouteInBuild('settings', false)).toBe(true);
    expect(canOpenRouteInBuild('chat/[id]', false)).toBe(true);
  });
});

