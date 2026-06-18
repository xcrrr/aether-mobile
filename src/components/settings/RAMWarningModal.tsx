import { Modal, View, Text, StyleSheet } from 'react-native';
import { Button } from '@/components/ds/Button';
import { colors, radius, spacing, fonts } from '@/theme';

/**
 * Shown when a model is about to load on a device that may not have enough free
 * RAM. The user can proceed anyway (at their own risk) or cancel the load.
 */
export function RAMWarningModal({ visible, available, required, onLoadAnyway, onCancel }: {
  visible: boolean;
  available: number;
  required: number;
  onLoadAnyway: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.scrim}>
        <View style={styles.card}>
          <Text style={styles.title}>Not enough RAM</Text>
          <Text style={styles.body}>
            This model may not fit in memory and could crash the app.
          </Text>

          <View style={styles.stats}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Available</Text>
              <Text style={[styles.statValue, { color: colors.danger }]}>{available.toFixed(1)} GB</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Recommended</Text>
              <Text style={styles.statValue}>{required.toFixed(1)} GB</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <View style={styles.action}><Button label="Cancel" variant="secondary" onPress={onCancel} /></View>
            <View style={styles.action}><Button label="Load Anyway" variant="danger" onPress={onLoadAnyway} /></View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 340, backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: spacing.xl, gap: spacing.md },
  title: { color: colors.text, fontSize: 18, fontFamily: fonts.sansHeavy },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 21, fontFamily: fonts.sans },
  stats: { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.sans },
  statValue: { color: colors.text, fontSize: 14, fontFamily: fonts.sansBold },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  action: { flex: 1 },
});
