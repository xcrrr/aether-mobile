import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { ModelDef } from '@/types';
import { ProgressBar } from '@/components/common/ProgressBar';
import { colors, radius, spacing } from '@/theme';

export function ModelManagerRow({ model, installed, download, onDownload, onCancel, onDelete }: {
  model: ModelDef;
  installed: boolean;
  download?: { pct: number; mbps: number; downloading: boolean };
  onDownload: () => void; onCancel: () => void; onDelete: () => void;
}) {
  const confirmDelete = () => Alert.alert(`Delete ${model.name}?`, "You'll need to download it again.",
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: onDelete }]);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{model.name}</Text>
          <Text style={styles.meta}>{model.maker} · {model.sizeLabel} · {model.badge}</Text>
        </View>
        {installed ? (
          <Pressable style={styles.del} onPress={confirmDelete}><Text style={styles.delTxt}>Delete</Text></Pressable>
        ) : download?.downloading ? (
          <Pressable style={styles.cancel} onPress={onCancel}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
        ) : (
          <Pressable style={styles.get} onPress={onDownload}><Text style={styles.getTxt}>Download</Text></Pressable>
        )}
      </View>
      <Text style={styles.desc}>{model.description}</Text>
      {download?.downloading && (
        <View style={{ marginTop: spacing.sm }}>
          <ProgressBar percent={download.pct} />
          <Text style={styles.meta}>{Math.round(download.pct)}% · {download.mbps.toFixed(1)} MB/s</Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center' },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  desc: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm },
  get: { backgroundColor: colors.purple, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  getTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  cancel: { borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  cancelTxt: { color: colors.text, fontSize: 13 },
  del: { backgroundColor: '#2A1414', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  delTxt: { color: colors.danger, fontWeight: '700', fontSize: 13 },
});
