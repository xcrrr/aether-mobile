import { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { MODELS } from '@/models/registry';
import * as MM from '@/models/ModelManager';
import { useModelStore } from '@/state/useModelStore';
import { useProfileStore } from '@/state/useProfileStore';
import * as Llama from '@/llm/engine';
import { StorageBar, StorageSegment } from '@/components/settings/StorageBar';
import { ModelManagerRow } from '@/components/settings/ModelManagerRow';
import { ThemePref } from '@/storage/profile';
import { spacing, fonts, radius, Palette } from '@/theme';
import { useColors } from '@/theme/useColors';

const THEME_OPTIONS: { id: ThemePref; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

export default function Settings() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { installed, downloads, download, cancel, remove } = useModelStore();
  const themePref = useProfileStore((s) => s.themePref);
  const setThemePref = useProfileStore((s) => s.setThemePref);
  const [disk, setDisk] = useState({ total: 0, free: 0, used: 0 });

  const refresh = useCallback(() => {
    (async () => {
      const [total, free, used] = await Promise.all([MM.totalBytes(), MM.freeBytes(), MM.installedBytes()]);
      setDisk({ total, free, used });
    })();
  }, []);
  useFocusEffect(refresh);

  const totalGb = disk.total / 1e9;
  const usedGb = (disk.total - disk.free) / 1e9;
  const modelSegments: StorageSegment[] = MODELS
    .filter((m) => installed[m.id])
    .map((m) => ({ label: m.name, gb: m.sizeBytes / 1e9, color: m.color }));
  const modelsGb = modelSegments.reduce((a, s) => a + s.gb, 0);
  const otherGb = Math.max(0, usedGb - modelsGb);
  const segments: StorageSegment[] = [...modelSegments, { label: 'Other apps', gb: otherGb, color: c.textMuted }];

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.title}>Settings & Storage</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <View>
          <Text style={styles.label}>Appearance</Text>
          <View style={styles.segment}>
            {THEME_OPTIONS.map((opt) => {
              const active = themePref === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                  onPress={() => { void setThemePref(opt.id); }}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.navHint}>System follows your device's light/dark setting.</Text>
        </View>

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

        <Text style={styles.footer}>
          Each model is one file with vision built in — no extra downloads.{'\n'}Runs fully offline. No account, no telemetry.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  back: { fontSize: 28, color: c.text, lineHeight: 30 },
  title: { color: c.text, fontSize: 20, fontFamily: fonts.displayBold },
  label: { color: c.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.md, fontFamily: fonts.sansSemibold },
  segment: { flexDirection: 'row', backgroundColor: c.bgInput, borderRadius: radius.md, overflow: 'hidden', padding: 3, gap: 3 },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: c.violet },
  segmentText: { color: c.textMuted, fontSize: 13, fontFamily: fonts.sansSemibold },
  segmentTextActive: { color: c.white },
  navHint: { color: c.textMuted, fontSize: 12, fontFamily: fonts.sans, marginTop: spacing.sm },
  storageCard: { paddingVertical: spacing.xs },
  storageHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  used: { color: c.text, fontSize: 14, fontFamily: fonts.sansBold },
  total: { color: c.textMuted, fontSize: 13, fontFamily: fonts.sans },
  footer: { textAlign: 'center', color: c.textMuted, fontSize: 12, lineHeight: 19, fontFamily: fonts.sans },
});
