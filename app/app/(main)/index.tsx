import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { Button } from '@/components/ds/Button';
import { Logo } from '@/components/ds/Logo';
import { ProgressBar } from '@/components/common/ProgressBar';
import { useChatStore } from '@/state/useChatStore';
import { useModelStore } from '@/state/useModelStore';
import { getModelById } from '@/models/registry';
import { spacing, fonts, Palette, fontSize } from '@/theme';
import { useColors, useIsDark } from '@/theme/useColors';

export default function MainIndex() {
  const c = useColors();
  const isDark = useIsDark();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { index, current, newChat } = useChatStore();
  const { activeModelId, installed, downloads, hydrate, reattachDownloads } = useModelStore();
  const modelReady = !!activeModelId && !!installed[activeModelId];
  const downloadingId = Object.keys(downloads).find((id) => downloads[id]?.downloading);
  const downloading = downloadingId ? downloads[downloadingId] : undefined;
  const downloadingModel = downloadingId ? getModelById(downloadingId) : undefined;
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    void hydrate()
      .then(() => reattachDownloads())
      .finally(() => {
        if (alive) setHydrated(true);
      });
    return () => {
      alive = false;
    };
  }, [hydrate, reattachDownloads]);

  // Index is the drawer's initial route, so every back action — including the
  // system gesture out of Settings or Core — lands here. Returning to an existing
  // chat is resolved during render below, not in an effect: an effect leaves one
  // painted frame of empty screen first, which is the gray screen users hit on
  // back. Only the case that has no chat to return to needs async work.
  const existingChatId = current?.id ?? index.find((meta) => installed[meta.modelId])?.id;
  const needsNewChat = hydrated && modelReady && !!activeModelId && !existingChatId;

  useFocusEffect(
    useCallback(() => {
      if (!needsNewChat || !activeModelId) return;
      let cancelled = false;
      void (async () => {
        const id = await newChat(activeModelId);
        if (!cancelled) router.replace(`/(main)/chat/${id}`);
      })();
      return () => {
        cancelled = true;
      };
    }, [activeModelId, needsNewChat, newChat]),
  );

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

  // Synchronous hand-off: back-navigation never paints an empty screen.
  if (hydrated && modelReady && existingChatId) {
    return <Redirect href={`/(main)/chat/${existingChatId}`} />;
  }

  // Still hydrating, or a chat is being created — show the brand, never a bare
  // rectangle. This is the state the old blank <View> was silently rendering.
  if (!hydrated || modelReady) {
    return (
      <View style={styles.c}>
        <Logo size={56} tone={isDark ? 'white' : 'violet'} style={styles.logo} />
      </View>
    );
  }

  return (
    <View style={styles.c}>
      <Animated.View style={[styles.center, enter]}>
        <Logo size={56} tone={isDark ? 'white' : 'violet'} style={styles.logo} />
        <Text style={styles.title}>Aether</Text>
        <Text style={styles.sub}>
          {downloadingModel ? `Downloading ${downloadingModel.name}…` : 'Download a model to begin.'}
        </Text>
        <View style={{ height: spacing.xl }} />
        {downloadingModel && downloading ? (
          <View style={styles.progressWrap}>
            <ProgressBar percent={downloading.pct} meta={`${Math.round(downloading.pct)}%${downloading.mbps > 0 ? ` · ${downloading.mbps.toFixed(1)} MB/s` : ''}`} />
          </View>
        ) : (
          <Button label="Get a model" onPress={start} block={false} style={styles.cta} />
        )}
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
  progressWrap: { width: 220 },
  sub: { color: c.textMuted, fontSize: fontSize.body, textAlign: 'center', lineHeight: 22, maxWidth: 280, fontFamily: fonts.sans },
});
