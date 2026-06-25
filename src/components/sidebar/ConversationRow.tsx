import { useMemo } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { ConversationMeta } from '@/types';
import { spacing, fonts, Palette } from '@/theme';
import { useColors } from '@/theme/useColors';

export function ConversationRow({ meta, active, onPress, onLongPress }: {
  meta: ConversationMeta; active?: boolean; onPress: () => void; onLongPress: () => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable style={styles.row} onPress={onPress} onLongPress={onLongPress}>
      <Text
        style={[styles.title, { color: active ? c.text : c.textMuted }]}
        numberOfLines={1}
      >
        {meta.title}
      </Text>
      {!!meta.preview && <Text style={styles.preview} numberOfLines={1}>{meta.preview}</Text>}
    </Pressable>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  // Just text — no card, no border, no active pill. Active = brighter title.
  row: { paddingVertical: 9, marginBottom: spacing.xs },
  title: { fontSize: 15, fontFamily: fonts.display },
  preview: { color: c.textMuted, fontSize: 12, marginTop: 2, fontFamily: fonts.sans, opacity: 0.7 },
});
