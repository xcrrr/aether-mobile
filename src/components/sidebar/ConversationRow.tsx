import { Pressable, Text, StyleSheet } from 'react-native';
import { ConversationMeta } from '@/types';
import { colors, radius, spacing } from '@/theme';

export function ConversationRow({ meta, onPress, onLongPress }: {
  meta: ConversationMeta; onPress: () => void; onLongPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} onLongPress={onLongPress}>
      <Text style={styles.title} numberOfLines={1}>{meta.title}</Text>
      {!!meta.preview && <Text style={styles.preview} numberOfLines={1}>{meta.preview}</Text>}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, marginBottom: spacing.xs },
  title: { color: colors.text, fontSize: 14, fontWeight: '600' },
  preview: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
