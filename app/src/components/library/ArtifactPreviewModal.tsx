import { useMemo } from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { X, Download } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/ds/PressableScale';
import { ArtifactReader } from './ArtifactReader';
import { AgentArtifact } from '@/agent/types';
import { useExportStore } from '@/state/useExportStore';
import { deriveTitle } from '@/library/artifact';
import { spacing, Palette, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

/**
 * Transient full-screen reader for a Task output — the "See" action. Shows the
 * real result faithfully before it is kept, with Download available inline.
 * Purely a view; keeping to Library stays a separate deliberate act on the card.
 */
export function ArtifactPreviewModal({ visible, artifact, onClose }: {
  visible: boolean;
  artifact: AgentArtifact | null;
  onClose: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const id = artifact?.id ?? '';
  const exportPhase = useExportStore((s) => s.exports[id]?.phase);
  const exportUri = useExportStore((s) => s.exports[id]?.uri);
  const exportBusy = exportPhase === 'preparing' || exportPhase === 'saving';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <PressableScale onPress={onClose} hitSlop={10} style={styles.iconBtn}>
            <X size={20} color={c.text} strokeWidth={2} />
          </PressableScale>
          <Text style={styles.title} numberOfLines={1}>{artifact?.title || 'Output'}</Text>
          <PressableScale
            onPress={() => {
              if (!artifact || exportBusy) return;
              if (exportPhase === "done" && exportUri) { useExportStore.getState().open(exportUri); return; }
              void useExportStore.getState().exportArtifact({
                id: artifact.id,
                title: deriveTitle(artifact.title, artifact.content),
                content: artifact.content,
              });
            }}
            hitSlop={10}
            style={styles.iconBtn}
            disabled={!artifact || exportBusy}
            accessibilityRole="button"
            accessibilityLabel="Download PDF"
            accessibilityState={{ disabled: !artifact || exportBusy, busy: exportBusy }}
          >
            <Download
              size={19}
              color={exportPhase === "failed" ? c.danger : exportPhase === "done" ? c.success : c.textMuted}
              strokeWidth={1.9}
            />
          </PressableScale>
        </View>
        {artifact && <ArtifactReader content={artifact.content} />}
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: c.separator,
  },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: c.text, ...typography.sectionTitle, textAlign: 'center' },
});
