import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEYS } from './keys';
import { safeParse } from './json';
import { AppSettings } from '@/types';

const DEFAULT_SETTINGS: AppSettings = { activeModelId: null };

export async function loadSettings(): Promise<AppSettings> {
  return safeParse<AppSettings>(await AsyncStorage.getItem(KEYS.settings), DEFAULT_SETTINGS);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
}
