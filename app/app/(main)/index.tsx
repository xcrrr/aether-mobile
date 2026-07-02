import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/ds/Button';
import { Logo } from '@/components/ds/Logo';
import { useChatStore } from '@/state/useChatStore';
import { useModelStore } from '@/state/useModelStore';
import { spacing, fonts, Palette, fontSize } from '@/theme';
import { useColors, useIsDark } from '@/theme/useColors';

export default function MainIndex() {
  const c = useColors();
  const isDark = useIsDark();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { index, current, newChat } = useChatStore();
  const { activeModelId, installed, hydrate } = useModelStore();
  const modelReady = !!activeModelId && !!installed[activeModelId];
  const [hydrated, setHydrated] = useState(false);
  const redirecting = useRef(false);

  useEffect(() => {
    let alive = true;
    void hydrate().finally(() => {
      if (alive) setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !modelReady || !activeModelId || redirecting.current) return;
    redirecting.current = true;
    void (async () => {
      const existing = current?.id ?? index.find((meta) => installed[meta.modelId])?.id;
      if (existing) {
        router.replace(`/(main)/chat/${existing}`);
        return;
      }
      const id = await newChat(activeModelId);
      router.replace(`/(main)/chat/${id}`);
    })();
  }, [activeModelId, current?.id, hydrated, index, installed, modelReady, newChat]);

  const start = async () => {
    if (!modelReady) return router.push('/(main)/settings');
    const id = await newChat(activeModelId);
    router.replace(`/(main)/chat/${id}`);
  };

  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a]);
  const enter = { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] };

  if (!hydrated || modelReady || redirecting.current) return <View style={styles.c} />;

  return (
    <View style={styles.c}>
      <Animated.View style={[styles.center, enter]}>
        <Logo size={56} tone={isDark ? 'white' : 'violet'} style={styles.logo} />
        <Text style={styles.title}>Aether</Text>
        <Text style={styles.sub}>
          {modelReady ? 'Start a conversation with your local model.' : 'Download a model to begin.'}
        </Text>
        <View style={{ height: spacing.xl }} />
        <Button label={modelReady ? 'New chat' : 'Get a model'} onPress={start} block={false} style={styles.cta} />
      </Animated.View>
    </View>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  center: { alignItems: 'center', gap: spacing.sm },
  logo: { alignSelf: 'center' },
  title: { fontFamily: fonts.displayBold, fontSize: fontSize.hero, color: c.text, marginTop: spacing.sm },
  cta: { alignSelf: 'center' },
  sub: { color: c.textMuted, fontSize: fontSize.body, textAlign: 'center', lineHeight: 22, maxWidth: 280, fontFamily: fonts.sans },
});
