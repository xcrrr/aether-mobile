import { useMemo } from 'react';
import { View, Text, StyleSheet, DimensionValue } from 'react-native';
import { radius, fonts, spacing, Palette } from '@/theme';
import { useColors } from '@/theme/useColors';

export function ProgressBar({ percent, height = 6, label, meta }: {
  percent: number;
  height?: number;
  label?: string;
  meta?: string;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const width = `${Math.min(100, Math.max(0, percent))}%` as DimensionValue;
  return (
    <View>
      {(label || meta) && (
        <View style={styles.head}>
          {!!label && <Text style={styles.label}>{label}</Text>}
          {!!meta && <Text style={styles.meta}>{meta}</Text>}
        </View>
      )}
      <View style={[styles.track, { height, borderRadius: radius.sm }]}>
        <View style={[styles.fill, { width }]} />
      </View>
    </View>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  label: { color: c.text, fontSize: 12, fontFamily: fonts.sans },
  meta: { color: c.textMuted, fontSize: 12, fontFamily: fonts.sans },
  track: { backgroundColor: c.assistantBubble, overflow: 'hidden', width: '100%' },
  fill: { height: '100%', backgroundColor: c.violet, borderRadius: radius.sm },
});
