import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEYS } from './keys';
import { safeParse } from './json';
import { UserProfile } from '@/types';

export async function loadProfile(): Promise<UserProfile | null> {
  return safeParse<UserProfile | null>(await AsyncStorage.getItem(KEYS.profile), null);
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(KEYS.profile, JSON.stringify(profile));
}

export type ThemePref = 'light' | 'dark' | 'system';

export async function loadThemePref(): Promise<ThemePref> {
  const v = await AsyncStorage.getItem(KEYS.themePref);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark';
}

/** Haptic ticking while a reply streams. On unless the user turns it off. */
export async function loadReplyHaptics(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.replyHaptics)) !== 'off';
}

export async function saveReplyHaptics(on: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.replyHaptics, on ? 'on' : 'off');
}

export async function saveThemePref(pref: ThemePref): Promise<void> {
  await AsyncStorage.setItem(KEYS.themePref, pref);
}

export async function isOnboardingComplete(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.onboardingComplete)) === 'true';
}

export async function setOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(KEYS.onboardingComplete, 'true');
}
