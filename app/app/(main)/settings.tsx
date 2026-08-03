import { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, Text, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/ds/PressableScale';
import { useFocusEffect, router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { MODELS } from '@/models/registry';
import { useModelStore } from '@/state/useModelStore';
import { useProfileStore } from '@/state/useProfileStore';
import { useChatStore } from '@/state/useChatStore';
import { StorageBar, StorageSegment } from '@/components/settings/StorageBar';
import { ModelManagerRow } from '@/components/settings/ModelManagerRow';
import { LegalCenter } from '@/components/legal/LegalCenter';
import { ThemePref } from '@/storage/profile';
import { spacing, fonts, radius, Palette, fontSize, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

const THEME_OPTIONS: { id: ThemePref; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

export default function Settings() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { installed, downloads, download, cancel, remove, reattachDownloads } = useModelStore();
  const currentChatId = useChatStore((s) => s.current?.id ?? null);
  const chatIndex = useChatStore((s) => s.index);
  const themePref = useProfileStore((s) => s.themePref);
  const setThemePref = useProfileStore((s) => s.setThemePref);
  const replyHaptics = useProfileStore((s) => s.replyHaptics);
  const setReplyHaptics = useProfileStore((s) => s.setReplyHaptics);
  const [disk, setDisk] = useState({ total: 0, free: 0, used: 0 });

  const refresh = useCallback(() => {
    (async () => {
      await reattachDownloads();
      const MM = require('@/models/ModelManager') as typeof import('@/models/ModelManager');
      const [total, free, used] = await Promise.all([MM.totalBytes(), MM.freeBytes(), MM.installedBytes()]);
      setDisk({ total, free, used });
    })();
  }, [reattachDownloads]);
  useFocusEffect(refresh);

  const totalGb = disk.total / 1e9;
  const usedGb = (disk.total - disk.free) / 1e9;
  const modelSegments: StorageSegment[] = MODELS
    .filter((m) => installed[m.id])
    .map((m) => ({ label: m.name, gb: m.sizeBytes / 1e9, color: m.color }));
  const modelsGb = modelSegments.reduce((a, s) => a + s.gb, 0);
  const otherGb = Math.max(0, usedGb - modelsGb);
  const segments: StorageSegment[] = [...modelSegments, { label: 'Other apps', gb: otherGb, color: c.textMuted }];
  const returnToChat = () => {
    const id = currentChatId ?? chatIndex[0]?.id;
    router.replace(id ? `/(main)/chat/${id}` : '/(main)');
  };

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <View style={styles.header}>
        <PressableScale onPress={returnToChat} hitSlop={10} style={styles.backBtn}>
          <ChevronLeft size={24} color={c.text} strokeWidth={1.8} />
        </PressableScale>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <View>
          <Text style={styles.label}>Appearance</Text>
          <View style={styles.segment}>
            {THEME_OPTIONS.map((opt) => {
              const active = themePref === opt.id;
              return (
                <PressableScale
                  key={opt.id}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                  onPress={() => { void setThemePref(opt.id); }}
                  scaleTo={0.97}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
                </PressableScale>
              );
            })}
          </View>
          <Text style={styles.navHint}>System follows your device's light/dark setting.</Text>
        </View>

        <View>
          <Text style={styles.label}>Feedback</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Vibrate while replying</Text>
              <Text style={styles.toggleHint}>
                A faint tick as each reply is written. Turn it off if you would rather it stayed quiet.
              </Text>
            </View>
            <Switch
              value={replyHaptics}
              onValueChange={(v) => { void setReplyHaptics(v); }}
              trackColor={{ false: c.border, true: c.violet }}
              thumbColor={c.white}
            />
          </View>
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
              onDelete={async () => { const Llm = require('@/llm/engine') as typeof import('@/llm/engine'); await Llm.releaseLlm(); await remove(m.id); refresh(); }}
            />
          ))}
        </View>

        <Text style={styles.footer}>
          Each model is one local file with image understanding built in.{'\n'}After download, regular chat runs on-device.
        </Text>

        <LegalCenter />
      </ScrollView>
    </SafeAreaView>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { color: c.text, ...typography.screenTitle },
  label: { color: c.textMuted, fontSize: fontSize.xs, textTransform: 'uppercase', letterSpacing: 0, marginBottom: spacing.md, fontFamily: fonts.sansSemibold },
  segment: { flexDirection: 'row', backgroundColor: c.bgInput, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: 3, gap: 3 },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: c.bgCard },
  segmentText: { color: c.textMuted, fontSize: fontSize.sm2, fontFamily: fonts.sansSemibold },
  segmentTextActive: { color: c.text },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: c.bgCard,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  toggleCopy: { flex: 1, gap: 2 },
  toggleTitle: { ...typography.sectionTitle, color: c.text },
  toggleHint: { ...typography.bodySmall, color: c.textMuted },
  navHint: { color: c.textMuted, fontSize: fontSize.sm, fontFamily: fonts.sans, marginTop: spacing.sm },
  storageCard: { paddingVertical: spacing.xs },
  storageHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  used: { color: c.text, ...typography.button },
  total: { color: c.textMuted, fontSize: fontSize.sm2, fontFamily: fonts.sans },
  footer: { textAlign: 'center', color: c.textMuted, fontSize: fontSize.sm, lineHeight: 19, fontFamily: fonts.sans },
});
