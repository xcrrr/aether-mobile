import { useMemo } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { ModelDef } from '@/types';
import { ProgressBar } from '@/components/common/ProgressBar';
import { Badge } from '@/components/ds/Badge';
import { Button } from '@/components/ds/Button';
import { spacing, fonts, Palette, fontSize, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

export function ModelManagerRow({ model, installed, download, onDownload, onCancel, onDelete }: {
  model: ModelDef;
  installed: boolean;
  download?: { pct: number; mbps: number; downloading: boolean };
  onDownload: () => void; onCancel: () => void; onDelete: () => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const confirmDelete = () => Alert.alert(`Delete ${model.name}?`, "You'll need to download it again.",
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: onDelete }]);

  const downloading = !!download?.downloading;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.name}>{model.name}</Text>
        <Badge label={model.badge} tone={model.badge === 'Recommended' ? 'accent' : 'blue'} />
      </View>
      <Text style={styles.desc}>{model.description}</Text>

      {downloading ? (
        <View style={{ gap: spacing.md }}>
          <ProgressBar percent={download!.pct} meta={`${Math.round(download!.pct)}% / ${download!.mbps.toFixed(1)} MB/s`} />
          <Button label="Cancel" variant="secondary" size="sm" onPress={onCancel} />
        </View>
      ) : installed ? (
        <View style={styles.footerRow}>
          <Text style={styles.meta}>{model.sizeLabel} / Downloaded</Text>
          <Button label="Delete" variant="danger" size="sm" block={false} onPress={confirmDelete} />
        </View>
      ) : (
        <View style={styles.footerRow}>
          <Text style={styles.meta}>{model.sizeLabel}</Text>
          <Button label="Download" size="sm" block={false} onPress={onDownload} />
        </View>
      )}
    </View>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  card: { paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: c.separator },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  name: { color: c.text, ...typography.sectionTitle },
  desc: { color: c.textMuted, fontSize: 13.5, lineHeight: 21, marginBottom: spacing.md, fontFamily: fonts.sans },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  meta: { color: c.textMuted, fontSize: fontSize.sm, fontFamily: fonts.sans },
});
