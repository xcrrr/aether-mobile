import { View, Text, StyleSheet } from 'react-native';
import { ProgressBar } from '@/components/common/ProgressBar';
import { formatBytes } from './format';
import { colors, radius, spacing } from '@/theme';

export function StorageBar({ total, free, aetherUsed }: { total: number; free: number; aetherUsed: number }) {
  const used = total - free;
  const pct = total > 0 ? (used / total) * 100 : 0;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>Device Storage</Text>
        <Text style={styles.muted}>{formatBytes(used)} used</Text>
      </View>
      <ProgressBar percent={pct} />
      <Text style={styles.sub}>{formatBytes(used)} / {formatBytes(total)} total · {formatBytes(free)} free</Text>
      <Text style={styles.aether}>Aether models: {formatBytes(aetherUsed)}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { color: colors.text, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 13 },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  aether: { color: colors.purple, fontSize: 12, marginTop: spacing.xs, fontWeight: '600' },
});
