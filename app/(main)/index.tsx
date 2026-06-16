import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/common/Button';
import { useChatStore } from '@/state/useChatStore';
import { useModelStore } from '@/state/useModelStore';
import { colors, spacing } from '@/theme';

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
      <Text style={styles.h}>Aether</Text>
      <Text style={styles.sub}>
        {activeModelId ? 'Private, on-device AI. Start a conversation.' : 'Download a model to begin.'}
      </Text>
      <View style={{ height: spacing.xl }} />
      <Button label={activeModelId ? 'New chat' : 'Get a model'} onPress={start} />
    </View>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  h: { color: colors.text, fontSize: 32, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 15, textAlign: 'center', marginTop: spacing.sm },
});
