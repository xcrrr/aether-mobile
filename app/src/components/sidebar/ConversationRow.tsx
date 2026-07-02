import { useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';
import { PressableScale } from '@/components/ds/PressableScale';
import { ConversationMeta } from '@/types';
import { spacing, fonts, Palette, fontSize, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

export function ConversationRow({ meta, active, onPress, onLongPress }: {
  meta: ConversationMeta; active?: boolean; onPress: () => void; onLongPress: () => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <PressableScale style={styles.row} onPress={onPress} onLongPress={onLongPress} scaleTo={0.98}>
      <Text
        style={[styles.title, { color: active ? c.text : c.textMuted }]}
        numberOfLines={1}
      >
        {meta.title}
      </Text>
      {!!meta.preview && <Text style={styles.preview} numberOfLines={1}>{meta.preview}</Text>}
    </PressableScale>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  // Just text — no card, no border, no active pill. Active = brighter title.
  row: { paddingVertical: 9, marginBottom: spacing.xs },
  title: { ...typography.label },
  preview: { color: c.textMuted, fontSize: fontSize.sm, marginTop: 2, fontFamily: fonts.sans, opacity: 0.7 },
});
