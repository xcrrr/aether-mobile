import { View, Text, StyleSheet, DimensionValue } from 'react-native';
import { colors, radius, fonts, spacing } from '@/theme';

export function ProgressBar({ percent, height = 6, label, meta }: {
  percent: number;
  height?: number;
  label?: string;
  meta?: string;
}) {
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
const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  label: { color: colors.text, fontSize: 12, fontFamily: fonts.sans },
  meta: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.sans },
  track: { backgroundColor: colors.assistantBubble, overflow: 'hidden', width: '100%' },
  fill: { height: '100%', backgroundColor: colors.violet, borderRadius: radius.sm },
});
