import { useCallback, useState } from 'react';
import { View, ScrollView, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, Trash2 } from 'lucide-react-native';
import { useFocusEffect, router } from 'expo-router';
import { MODELS } from '@/models/registry';
import { ModelDef } from '@/types';
import * as MM from '@/models/ModelManager';
import { useModelStore } from '@/state/useModelStore';
import * as Llama from '@/llm/LlamaService';
import { StorageBar, StorageSegment } from '@/components/settings/StorageBar';
import { ModelManagerRow } from '@/components/settings/ModelManagerRow';
import { ProgressBar } from '@/components/common/ProgressBar';
import { colors, spacing, fonts } from '@/theme';

const VISION_MODELS = MODELS.filter((m) => m.mmprojFilename);

const VISION_STATUS_LABEL: Record<string, string> = {
  unsupported: 'Not supported by this model',
  not_downloaded: 'Not downloaded',
  verifying: 'Verifying…',
  working: '✓ Working',
  error: 'Unavailable',
};

export default function Settings() {
  const {
    installed, downloads, download, cancel, remove,
    visionInstalled, visionDownloads, downloadVision, cancelVision, removeVision, refreshVision,
  } = useModelStore();
  const [disk, setDisk] = useState({ total: 0, free: 0, used: 0 });

  const refresh = useCallback(() => {
    (async () => {
      const [total, free, used] = await Promise.all([MM.totalBytes(), MM.freeBytes(), MM.installedBytes()]);
      setDisk({ total, free, used });
      await refreshVision();
    })();
  }, [refreshVision]);
  useFocusEffect(refresh);

  const totalGb = disk.total / 1e9;
  const usedGb = (disk.total - disk.free) / 1e9;
  const modelSegments: StorageSegment[] = MODELS
    .filter((m) => installed[m.id])
    .map((m) => ({ label: m.name, gb: m.sizeBytes / 1e9, color: m.color }));
  const modelsGb = modelSegments.reduce((a, s) => a + s.gb, 0);
  const otherGb = Math.max(0, usedGb - modelsGb);
  const segments: StorageSegment[] = [...modelSegments, { label: 'Other apps', gb: otherGb, color: colors.textMuted }];

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.title}>Settings & Storage</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <View>
          <Text style={styles.label}>Device storage</Text>
          <View style={styles.storageCard}>
            <View style={styles.storageHead}>
              <Text style={styles.used}>{usedGb.toFixed(1)} GB used</Text>
              <Text style={styles.total}>{totalGb.toFixed(0)} GB total</Text>
            </View>
            <StorageBar totalGb={totalGb} segments={segments} />
          </View>
        </View>

        <View>
          <Text style={styles.label}>Second Brain</Text>
          <Pressable style={styles.navRow} onPress={() => router.push('/(main)/second-brain')}>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>Aether's memory of you</Text>
              <Text style={styles.navHint}>Private, on-device personal context</Text>
            </View>
            <Text style={styles.navChevron}>›</Text>
          </Pressable>
        </View>

        <View>
          <Text style={styles.label}>Models</Text>
          {MODELS.map((m) => (
            <ModelManagerRow
              key={m.id}
              model={m}
              installed={!!installed[m.id]}
              download={downloads[m.id]}
              onDownload={() => download(m.id)}
              onCancel={() => cancel(m.id)}
              onDelete={async () => { await Llama.releaseLlm(); await remove(m.id); refresh(); }}
            />
          ))}
        </View>

        {VISION_MODELS.length > 0 && (
          <View>
            <Text style={styles.label}>Image understanding</Text>
            {VISION_MODELS.map((m) => (
              <VisionPackRow
                key={m.id}
                model={m}
                installed={!!visionInstalled[m.id]}
                download={visionDownloads[m.id]}
                onDownload={() => downloadVision(m.id)}
                onCancel={() => cancelVision(m.id)}
                onDelete={async () => { await Llama.releaseLlm(); await removeVision(m.id); refresh(); }}
              />
            ))}
            <Text style={styles.visionHint}>
              Optional vision packs let a model analyze photos you attach. Big one-time download; runs fully offline after.
            </Text>
          </View>
        )}

        <Text style={styles.footer}>
          Models download from Hugging Face once, then run fully offline.{'\n'}No account, no telemetry.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function VisionPackRow({ model, installed, download, onDownload, onCancel, onDelete }: {
  model: ModelDef;
  installed: boolean;
  download?: { pct: number; mbps: number; downloading: boolean };
  onDownload: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const sizeGb = ((model.mmprojSizeBytes ?? 0) / 1e9).toFixed(2);
  const downloading = !!download?.downloading;

  return (
    <View style={styles.visionRow}>
      <View style={styles.visionIcon}>
        <Eye size={18} color={colors.violet} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.visionTitle} numberOfLines={1}>{model.name} · Vision pack</Text>
        {downloading ? (
          <View style={{ marginTop: 6, gap: 4 }}>
            <ProgressBar percent={download?.pct ?? 0} height={4} />
            <Text style={styles.visionMeta}>{Math.round(download?.pct ?? 0)}% · {(download?.mbps ?? 0).toFixed(1)} MB/s</Text>
          </View>
        ) : (
          <Text style={styles.visionMeta}>{installed ? 'Downloaded' : `${sizeGb} GB — ${VISION_STATUS_LABEL.not_downloaded}`}</Text>
        )}
      </View>
      {downloading ? (
        <Pressable onPress={onCancel} hitSlop={8} style={styles.visionBtn}>
          <Text style={styles.visionBtnText}>Cancel</Text>
        </Pressable>
      ) : installed ? (
        <Pressable onPress={onDelete} hitSlop={8} style={styles.visionIconBtn}>
          <Trash2 size={18} color={colors.textMuted} strokeWidth={2} />
        </Pressable>
      ) : (
        <Pressable onPress={onDownload} hitSlop={8} style={[styles.visionBtn, styles.visionBtnPrimary]}>
          <Text style={[styles.visionBtnText, { color: colors.white }]}>Download</Text>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  back: { fontSize: 28, color: colors.text, lineHeight: 30 },
  title: { color: colors.text, fontSize: 18, fontFamily: fonts.sansHeavy },
  label: { color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.md, fontFamily: fonts.sansSemibold },
  navRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: spacing.lg },
  navTitle: { color: colors.text, fontSize: 15, fontFamily: fonts.sansSemibold },
  navHint: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.sans, marginTop: 3 },
  navChevron: { color: colors.textMuted, fontSize: 24, lineHeight: 26 },
  visionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: spacing.md, marginBottom: spacing.sm },
  visionIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.assistantBubble, alignItems: 'center', justifyContent: 'center' },
  visionTitle: { color: colors.text, fontSize: 14, fontFamily: fonts.sansSemibold },
  visionMeta: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.sans, marginTop: 2 },
  visionBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  visionBtnPrimary: { backgroundColor: colors.violet, borderColor: colors.violet },
  visionBtnText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.text },
  visionIconBtn: { padding: 8 },
  visionHint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, fontFamily: fonts.sans, marginTop: 4 },
  storageCard: { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: spacing.lg },
  storageHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  used: { color: colors.text, fontSize: 14, fontFamily: fonts.sansBold },
  total: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.sans },
  footer: { textAlign: 'center', color: colors.textMuted, fontSize: 12, lineHeight: 19, fontFamily: fonts.sans },
});
