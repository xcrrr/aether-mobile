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

export async function isOnboardingComplete(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.onboardingComplete)) === 'true';
}

export async function setOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(KEYS.onboardingComplete, 'true');
}
