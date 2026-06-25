import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { radius, spacing, fonts, Palette } from '@/theme';
import { useColors } from '@/theme/useColors';

export interface StorageSegment { label: string; gb: number; color: string; }

export function StorageBar({ totalGb, segments }: { totalGb: number; segments: StorageSegment[] }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const safeTotal = totalGb > 0 ? totalGb : 1;
  return (
    <View>
      <View style={styles.track}>
        {segments.map((s, i) => (
          <View key={i} style={{ width: `${Math.max(0, (s.gb / safeTotal) * 100)}%`, backgroundColor: s.color, height: '100%' }} />
        ))}
      </View>
      <View style={styles.legend}>
        {segments.map((s, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel}>{s.label}</Text>
            <Text style={styles.legendGb}>{s.gb.toFixed(1)} GB</Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.freeDot]} />
          <Text style={styles.legendGb}>
            {Math.max(0, safeTotal - segments.reduce((a, x) => a + x.gb, 0)).toFixed(1)} GB free
          </Text>
        </View>
      </View>
    </View>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  track: { flexDirection: 'row', height: 12, width: '100%', backgroundColor: c.assistantBubble, borderRadius: radius.full, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  freeDot: { backgroundColor: c.assistantBubble, borderWidth: 1, borderColor: c.border },
  legendLabel: { fontSize: 12, color: c.text, fontFamily: fonts.sans },
  legendGb: { fontSize: 12, color: c.textMuted, fontFamily: fonts.sans },
});
