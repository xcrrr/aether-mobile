import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/ds/Button';
import { Logo } from '@/components/ds/Logo';
import { useChatStore } from '@/state/useChatStore';
import { useModelStore } from '@/state/useModelStore';
import { colors, spacing, fonts } from '@/theme';

export default function MainIndex() {
  const newChat = useChatStore((s) => s.newChat);
  const activeModelId = useModelStore((s) => s.activeModelId);

  const start = async () => {
    if (!activeModelId) return router.push('/(main)/settings');
    const id = await newChat(activeModelId);
    router.push(`/(main)/chat/${id}`);
  };

  return (
    <View style={styles.c}>
      <Logo size={56} tone="white" style={styles.logo} />
      <Text style={styles.sub}>
        {activeModelId ? 'Private, on-device AI. Start a conversation — nothing leaves your phone.' : 'Download a model to begin.'}
      </Text>
      <View style={{ height: spacing.xl }} />
      <Button label={activeModelId ? 'New chat' : 'Get a model'} onPress={start} block={false} style={styles.cta} />
    </View>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  logo: { alignSelf: 'center' },
  cta: { alignSelf: 'center' },
  sub: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 280, fontFamily: fonts.sans },
});
