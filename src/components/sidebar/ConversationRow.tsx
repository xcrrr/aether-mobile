import { Pressable, Text, StyleSheet } from 'react-native';
import { ConversationMeta } from '@/types';
import { colors, radius, spacing, fonts } from '@/theme';

export function ConversationRow({ meta, active, onPress, onLongPress }: {
  meta: ConversationMeta; active?: boolean; onPress: () => void; onLongPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.row, active && { backgroundColor: colors.assistantBubble }]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <Text style={[styles.title, { fontFamily: active ? fonts.sansSemibold : fonts.sans }]} numberOfLines={1}>{meta.title}</Text>
      {!!meta.preview && <Text style={styles.preview} numberOfLines={1}>{meta.preview}</Text>}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, marginBottom: spacing.xs },
  title: { color: colors.text, fontSize: 14 },
  preview: { color: colors.textMuted, fontSize: 12, marginTop: 2, fontFamily: fonts.sans },
});
