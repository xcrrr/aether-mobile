import { renderHook } from '@testing-library/react';
import { useReducedMotion } from '@/lib/useReducedMotion';

function mockMatchMedia(matches: boolean) {
  window.matchMedia = jest.fn().mockReturnValue({
    matches, addEventListener: jest.fn(), removeEventListener: jest.fn(),
  }) as unknown as typeof window.matchMedia;
}

test('returns true when user prefers reduced motion', () => {
  mockMatchMedia(true);
  const { result } = renderHook(() => useReducedMotion());
  expect(result.current).toBe(true);
});

test('returns false otherwise', () => {
  mockMatchMedia(false);
  const { result } = renderHook(() => useReducedMotion());
  expect(result.current).toBe(false);
});
