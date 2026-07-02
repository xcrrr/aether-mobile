import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Slot } from 'expo-router';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
} from '@expo-google-fonts/instrument-sans';
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
} from '@expo-google-fonts/newsreader';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { AppErrorBoundary } from '@/components/common/AppErrorBoundary';
import { useProfileStore } from '@/state/useProfileStore';
import { useChatStore } from '@/state/useChatStore';
import { colors } from '@/theme';
import { useColors, useIsDark } from '@/theme/useColors';

// Paint the native root view (dark default) so resizing for the keyboard never
// flashes the default white window background. Re-painted per theme below.
SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});

const STARTUP_WAIT_MS = 3500;

export default function RootLayout() {
  const c = useColors();
  const isDark = useIsDark();
  const [ready, setReady] = useState(false);
  const [startupTimedOut, setStartupTimedOut] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    'InstrumentSans': InstrumentSans_400Regular,
    'InstrumentSans-Medium': InstrumentSans_500Medium,
    'InstrumentSans-SemiBold': InstrumentSans_600SemiBold,
    'Newsreader': Newsreader_400Regular,
    'Newsreader-Italic': Newsreader_400Regular_Italic,
    'Newsreader-Medium': Newsreader_500Medium,
  });

  useEffect(() => {
    (async () => {
      try {
        const { markInterruptedTasks } = require('@/agent/taskStorage') as typeof import('@/agent/taskStorage');
        await Promise.all([
          useProfileStore.getState().hydrate(),
          useChatStore.getState().refreshIndex(),
          // Agent tasks killed with the app must never read as still running.
          markInterruptedTasks(),
        ]);
      } catch (error) {
        console.warn('Aether startup hydration failed', error);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
  }, [c]);

  useEffect(() => {
    const id = setTimeout(() => setStartupTimedOut(true), STARTUP_WAIT_MS);
    return () => clearTimeout(id);
  }, []);

  const waitingOnStartup = !ready || (!fontsLoaded && !fontError);
  if (!startupTimedOut && waitingOnStartup) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  return (
    <AppErrorBoundary backgroundColor={c.bg} textColor={c.text} mutedColor={c.textMuted}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Slot />
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
