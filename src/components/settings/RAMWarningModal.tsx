import { useMemo } from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { Button } from '@/components/ds/Button';
import { radius, spacing, fonts, Palette } from '@/theme';
import { useColors } from '@/theme/useColors';

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
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
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
              <Text style={[styles.statValue, { color: c.danger }]}>{available.toFixed(1)} GB</Text>
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
const makeStyles = (c: Palette) => StyleSheet.create({
  scrim: { flex: 1, backgroundColor: c.scrim, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 340, backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1, borderRadius: 16, padding: spacing.xl, gap: spacing.md },
  title: { color: c.text, fontSize: 19, fontFamily: fonts.displayBold },
  body: { color: c.textMuted, fontSize: 14, lineHeight: 21, fontFamily: fonts.sans },
  stats: { backgroundColor: c.bg, borderColor: c.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { color: c.textMuted, fontSize: 13, fontFamily: fonts.sans },
  statValue: { color: c.text, fontSize: 14, fontFamily: fonts.sansBold },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  action: { flex: 1 },
});
