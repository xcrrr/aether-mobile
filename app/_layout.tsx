import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Slot } from 'expo-router';
import { View } from 'react-native';
import { useProfileStore } from '@/state/useProfileStore';
import { useModelStore } from '@/state/useModelStore';
import { useChatStore } from '@/state/useChatStore';
import { colors } from '@/theme';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
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
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Slot />
    </GestureHandlerRootView>
  );
}
