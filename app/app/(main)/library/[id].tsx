import { useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Download, Trash2 } from 'lucide-react-native';
import { PressableScale } from '@/components/ds/PressableScale';
import { ArtifactReader } from '@/components/library/ArtifactReader';
import { useLibraryStore } from '@/state/useLibraryStore';
import { useExportStore } from '@/state/useExportStore';
import { typeLabel } from '@/library/artifact';
import { spacing, Palette, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LibraryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const artifact = useLibraryStore((s) => s.items.find((a) => a.id === id));
  const exportPhase = useExportStore((s) => s.exports[id ?? '']?.phase);
  const exportUri = useExportStore((s) => s.exports[id ?? '']?.uri);
  const exportBusy = exportPhase === 'preparing' || exportPhase === 'saving';

  if (!artifact) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
            <ChevronLeft size={24} color={c.text} strokeWidth={1.8} />
          </PressableScale>
        </View>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Item not found.</Text>
        </View>
      </View>
    );
  }

  const confirmDelete = () => {
    Alert.alert(
      'Delete from Library?',
      `"${artifact.title}" will be removed from this device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await useLibraryStore.getState().remove(artifact.id);
              router.back();
            })();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <ChevronLeft size={24} color={c.text} strokeWidth={1.8} />
        </PressableScale>
        <Text style={styles.title} numberOfLines={1}>{artifact.title}</Text>
        <PressableScale
          onPress={() => {
            if (exportBusy) return;
            if (exportPhase === "done" && exportUri) { useExportStore.getState().open(exportUri); return; }
            void useExportStore.getState().exportArtifact({ id: artifact.id, title: artifact.title, content: artifact.content });
          }}
          hitSlop={10}
          disabled={exportBusy}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Download PDF"
          accessibilityState={{ disabled: exportBusy, busy: exportBusy }}
        >
          <Download
            size={20}
            color={exportPhase === "failed" ? c.danger : exportPhase === "done" ? c.success : c.textMuted}
            strokeWidth={1.8}
          />
        </PressableScale>
        <PressableScale onPress={confirmDelete} hitSlop={10} style={styles.iconBtn}>
          <Trash2 size={20} color={c.danger} strokeWidth={1.8} />
        </PressableScale>
      </View>
      <Text style={styles.meta}>
        {typeLabel(artifact)} · {formatDate(artifact.updatedAt ?? artifact.createdAt)}
      </Text>

      <ArtifactReader content={artifact.content} />

    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: c.text, ...typography.sectionTitle },
  meta: { color: c.textMuted, ...typography.metadata, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { color: c.textMuted, ...typography.body },
});
