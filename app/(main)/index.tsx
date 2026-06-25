import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Aurora } from '@/components/ds/Aurora';
import { Button } from '@/components/ds/Button';
import { Logo } from '@/components/ds/Logo';
import { useChatStore } from '@/state/useChatStore';
import { useModelStore } from '@/state/useModelStore';
import { spacing, fonts, Palette } from '@/theme';
import { useColors, useIsDark } from '@/theme/useColors';

export default function MainIndex() {
  const c = useColors();
  const isDark = useIsDark();
  const styles = useMemo(() => makeStyles(c), [c]);
  const newChat = useChatStore((s) => s.newChat);
  const activeModelId = useModelStore((s) => s.activeModelId);

  const start = async () => {
    if (!activeModelId) return router.push('/(main)/settings');
    const id = await newChat(activeModelId);
    router.push(`/(main)/chat/${id}`);
  };

  return (
    <View style={styles.c}>
      <Aurora />
      <Logo size={56} tone={isDark ? 'white' : 'violet'} style={styles.logo} />
      <Text style={styles.title}>Aether</Text>
      <Text style={styles.sub}>
        {activeModelId ? 'Private, on-device AI. Start a conversation — nothing leaves your phone.' : 'Download a model to begin.'}
      </Text>
      <View style={{ height: spacing.xl }} />
      <Button label={activeModelId ? 'New chat' : 'Get a model'} onPress={start} block={false} style={styles.cta} />
    </View>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  logo: { alignSelf: 'center' },
  title: { fontFamily: fonts.sansHeavy, fontSize: 34, color: c.text, letterSpacing: -0.5, marginTop: spacing.sm },
  cta: { alignSelf: 'center' },
  sub: { color: c.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 280, fontFamily: fonts.sans },
});
