import { View, StyleSheet, DimensionValue } from 'react-native';
import { colors, radius } from '@/theme';

export function ProgressBar({ percent }: { percent: number }) {
  const width = `${Math.min(100, Math.max(0, percent))}%` as DimensionValue;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width }]} />
    </View>
  );
}
const styles = StyleSheet.create({
  track: { height: 8, backgroundColor: colors.border, borderRadius: radius.sm, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.purple, borderRadius: radius.sm },
});
