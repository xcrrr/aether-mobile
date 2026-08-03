import * as Haptics from 'expo-haptics';
import { startReplyHaptics, stopReplyHaptics, isReplyHapticsRunning } from './replyHaptics';
import { useProfileStore } from '@/state/useProfileStore';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Soft: 'soft', Light: 'light' },
}));

const impact = Haptics.impactAsync as jest.MockedFunction<typeof Haptics.impactAsync>;

beforeEach(() => {
  jest.useFakeTimers();
  impact.mockClear();
  useProfileStore.setState({ replyHaptics: true });
});

afterEach(() => {
  stopReplyHaptics();
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('ticks continuously while a reply is being written', () => {
  startReplyHaptics();
  expect(impact).toHaveBeenCalledTimes(1); // immediate, no wait for the first tick
  jest.advanceTimersByTime(450);
  expect(impact.mock.calls.length).toBeGreaterThan(4);
  expect(impact).toHaveBeenCalledWith('soft');
});

it('does nothing at all when the switch is off', () => {
  useProfileStore.setState({ replyHaptics: false });
  startReplyHaptics();
  jest.advanceTimersByTime(900);
  expect(impact).not.toHaveBeenCalled();
});

it('goes quiet immediately when the switch is turned off mid-reply', () => {
  startReplyHaptics();
  jest.advanceTimersByTime(300);
  const before = impact.mock.calls.length;
  expect(before).toBeGreaterThan(0);

  useProfileStore.setState({ replyHaptics: false });
  jest.advanceTimersByTime(900);
  expect(impact.mock.calls.length).toBe(before);
});

it('resumes when the switch is turned back on', () => {
  useProfileStore.setState({ replyHaptics: false });
  startReplyHaptics();
  jest.advanceTimersByTime(300);
  expect(impact).not.toHaveBeenCalled();

  useProfileStore.setState({ replyHaptics: true });
  jest.advanceTimersByTime(300);
  expect(impact.mock.calls.length).toBeGreaterThan(0);
});

it('stops on demand and leaves no timer behind', () => {
  startReplyHaptics();
  jest.advanceTimersByTime(200);
  stopReplyHaptics();
  const after = impact.mock.calls.length;

  jest.advanceTimersByTime(2000);
  expect(impact.mock.calls.length).toBe(after);
  expect(isReplyHapticsRunning()).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
});

it('does not stack timers if a reply somehow starts twice', () => {
  startReplyHaptics();
  startReplyHaptics();
  expect(jest.getTimerCount()).toBe(1);
  stopReplyHaptics();
  expect(jest.getTimerCount()).toBe(0);
});
