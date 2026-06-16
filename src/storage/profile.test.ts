import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadProfile, saveProfile, isOnboardingComplete, setOnboardingComplete } from './profile';

beforeEach(() => AsyncStorage.clear());

describe('profile storage', () => {
  it('returns null when no profile saved', async () => {
    expect(await loadProfile()).toBeNull();
  });
  it('round-trips a profile', async () => {
    const p = { name: 'Adam', occupation: 'Builder', project: 'Aether', goals: 'ship', language: 'English' };
    await saveProfile(p);
    expect(await loadProfile()).toEqual(p);
  });
  it('tracks onboarding completion', async () => {
    expect(await isOnboardingComplete()).toBe(false);
    await setOnboardingComplete();
    expect(await isOnboardingComplete()).toBe(true);
  });
});
