import { useColorScheme } from 'react-native';
import { darkColors, lightColors, Palette } from '@/theme';
import { useProfileStore } from '@/state/useProfileStore';

// Resolve the active palette from the user's preference. 'system' tracks the
// OS dark-mode setting live via Appearance/useColorScheme.
export function useIsDark(): boolean {
  const pref = useProfileStore((s) => s.themePref);
  const scheme = useColorScheme();
  if (pref === 'system') return scheme !== 'light';
  return pref !== 'light';
}

export function useColors(): Palette {
  return useIsDark() ? darkColors : lightColors;
}
