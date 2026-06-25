import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Slot } from 'expo-router';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_800ExtraBold,
} from '@expo-google-fonts/playfair-display';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { useProfileStore } from '@/state/useProfileStore';
import { useModelStore } from '@/state/useModelStore';
import { useChatStore } from '@/state/useChatStore';
import { colors } from '@/theme';
import { useColors, useIsDark } from '@/theme/useColors';

// Paint the native root view (dark default) so resizing for the keyboard never
// flashes the default white window background. Re-painted per theme below.
SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});

export default function RootLayout() {
  const c = useColors();
  const isDark = useIsDark();
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    'Inter': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'Inter-Heavy': Inter_800ExtraBold,
    'PlayfairDisplay': PlayfairDisplay_600SemiBold,
    'PlayfairDisplay-Bold': PlayfairDisplay_700Bold,
    'PlayfairDisplay-Heavy': PlayfairDisplay_800ExtraBold,
  });

  useEffect(() => {
    (async () => {
      await Promise.all([
        useProfileStore.getState().hydrate(),
        useModelStore.getState().hydrate(),
        useChatStore.getState().refreshIndex(),
      ]);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
  }, [c]);

  if (!ready || !fontsLoaded) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Slot />
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
