import { useState } from 'react';
import { View, ScrollView, Text, Pressable, StyleSheet, Switch, Alert, ActivityIndicator, Modal } from 'react-native';
import { Graph3D } from '@/components/secondbrain/Graph3D';
import { toGraphData } from '@/components/secondbrain/graphData';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Trash2, Sparkles } from 'lucide-react-native';
import { useMemoryStore } from '@/secondbrain/MemoryStore';
import { MemoryCategory, MemoryEntry, MEMORY_CATEGORIES } from '@/secondbrain/types';
import { extractFromConversation } from '@/secondbrain/MemoryExtractor';
import { useChatStore } from '@/state/useChatStore';
import * as Llama from '@/llm/LlamaService';
import { colors, spacing, fonts, radius } from '@/theme';

function formatTime(ms: number): string {
  if (!ms) return 'Never';
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function groupByCategory(entries: MemoryEntry[]): [MemoryCategory, MemoryEntry[]][] {
  return MEMORY_CATEGORIES
    .map((c) => [c, entries.filter((e) => e.category === c)] as [MemoryCategory, MemoryEntry[]])
    .filter(([, list]) => list.length > 0);
}

export default function SecondBrainScreen() {
  const enabled = useMemoryStore((s) => s.enabled);
  const setEnabled = useMemoryStore((s) => s.setEnabled);
  const entries = useMemoryStore((s) => s.memory.entries);
  const lastExtractionAt = useMemoryStore((s) => s.memory.lastExtractionAt);
  const totalAnalyzed = useMemoryStore((s) => s.memory.totalConversationsAnalyzed);
  const deleteEntry = useMemoryStore((s) => s.deleteEntry);
  const clearAll = useMemoryStore((s) => s.clearAll);

  const edges = useMemoryStore((s) => s.memory.edges);
  const [analyzing, setAnalyzing] = useState(false);
  const [view, setView] = useState<'graph' | 'list'>('graph');
  const [selected, setSelected] = useState<MemoryEntry | null>(null);

  const graph = toGraphData(entries, edges ?? []);
  const onNodeTap = (key: string) => {
    const e = entries.find((x) => x.key === key);
    if (e) setSelected(e);
  };

  const grouped = groupByCategory(entries);

  const analyzeNow = async () => {
    if (!Llama.isModelLoaded()) {
      Alert.alert('Second Brain', 'Open a chat so the model loads, then come back and analyze.');
      return;
    }
    const convo = useChatStore.getState().current;
    if (!convo || convo.messages.length === 0) {
      Alert.alert('Second Brain', 'No conversation to analyze yet. Chat with Aether first, then tap this.');
      return;
    }
    setAnalyzing(true);
    try {
      const n = await extractFromConversation(convo.messages, convo.id, { force: true });
      Alert.alert(
        'Second Brain',
        n > 0
          ? `Learned or updated ${n} fact${n === 1 ? '' : 's'} from your latest chat.`
          : 'No new facts found in that conversation yet. Try sharing more about yourself.',
      );
    } catch {
      Alert.alert('Second Brain', 'Could not analyze right now — try again in a moment.');
    } finally {
      setAnalyzing(false);
    }
  };

  const confirmClear = () =>
    Alert.alert(
      'Clear all memory?',
      "This permanently deletes everything Aether has learned about you. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear all', style: 'destructive', onPress: () => clearAll() },
      ],
    );

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.title}>Second Brain</Text>
        <View style={styles.segment}>
          <Pressable
            style={[styles.segmentBtn, view === 'graph' && styles.segmentBtnActive]}
            onPress={() => setView('graph')}
          >
            <Text style={[styles.segmentText, view === 'graph' && styles.segmentTextActive]}>Graph</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, view === 'list' && styles.segmentBtnActive]}
            onPress={() => setView('list')}
          >
            <Text style={[styles.segmentText, view === 'list' && styles.segmentTextActive]}>List</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <Text style={styles.subtitle}>
          Aether's memory of you — fully private, stored only on this device.
        </Text>

        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Enable Second Brain</Text>
              <Text style={styles.toggleHint}>
                When off, no new memories are learned and existing ones aren't used.
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: colors.border, true: colors.violet }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        {enabled && (
          <Pressable
            style={[styles.analyzeBtn, analyzing && { opacity: 0.6 }]}
            onPress={analyzeNow}
            disabled={analyzing}
          >
            {analyzing
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Sparkles size={18} color={colors.white} strokeWidth={2} />}
            <Text style={styles.analyzeLabel}>{analyzing ? 'Analyzing…' : 'Analyze current chat now'}</Text>
          </Pressable>
        )}

        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Last extraction</Text>
            <Text style={styles.statusValue}>{formatTime(lastExtractionAt)}</Text>
          </View>
          <View style={[styles.statusRow, { marginBottom: 0 }]}>
            <Text style={styles.statusLabel}>Conversations analyzed</Text>
            <Text style={styles.statusValue}>{totalAnalyzed}</Text>
          </View>
        </View>

        {entries.length === 0 ? (
          <Text style={styles.empty}>
            Nothing learned yet. Keep chatting — Aether will quietly build a picture of you.
          </Text>
        ) : view === 'graph' ? (
          <View style={{ height: 420, borderRadius: radius.lg, overflow: 'hidden' }}>
            <Graph3D data={graph} onNodeTap={onNodeTap} />
          </View>
        ) : (
          grouped.map(([category, list]) => (
            <View key={category}>
              <Text style={styles.label}>{category}</Text>
              {list.map((e) => (
                <View key={e.id} style={styles.entryRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryKey}>{e.key}</Text>
                    <Text style={styles.entryValue}>{e.value}</Text>
                  </View>
                  <View style={styles.confidence}>
                    <Text style={styles.confidenceText}>{Math.round(e.confidence * 100)}%</Text>
                  </View>
                  <Pressable onPress={() => deleteEntry(e.id)} hitSlop={8} style={styles.trash}>
                    <Trash2 size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </View>
          ))
        )}

        {entries.length > 0 && (
          <Pressable style={styles.clearBtn} onPress={confirmClear}>
            <Text style={styles.clearLabel}>Clear all memory</Text>
          </Pressable>
        )}

        <Text style={styles.footer}>
          Memory is extracted on-device by your local model.{'\n'}Nothing is ever sent to a server.
        </Text>
      </ScrollView>
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)}>
          <View style={styles.modalCard}>
            {selected && (
              <>
                <Text style={styles.label}>{selected.category}</Text>
                <Text style={styles.entryKey}>{selected.key}</Text>
                <Text style={[styles.entryValue, { marginTop: 6 }]}>{selected.value}</Text>
                <Text style={[styles.confidenceText, { marginTop: 10 }]}>
                  {Math.round(selected.confidence * 100)}% confident{selected.stale ? ' · stale' : ''}
                </Text>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  back: { fontSize: 28, color: colors.text, lineHeight: 30 },
  title: { color: colors.text, fontSize: 18, fontFamily: fonts.sansHeavy },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, fontFamily: fonts.sans },
  card: { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  analyzeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.violet, borderRadius: radius.md, paddingVertical: 14 },
  analyzeLabel: { color: colors.white, fontSize: 15, fontFamily: fonts.sansBold },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  toggleLabel: { color: colors.text, fontSize: 15, fontFamily: fonts.sansSemibold },
  toggleHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, fontFamily: fonts.sans, marginTop: 3 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  statusLabel: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.sans },
  statusValue: { color: colors.text, fontSize: 13, fontFamily: fonts.sansMedium },
  label: { color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.md, fontFamily: fonts.sansSemibold },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  entryKey: { color: colors.text, fontSize: 14, fontFamily: fonts.sansSemibold },
  entryValue: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.sans, marginTop: 2 },
  confidence: { backgroundColor: colors.bg, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  confidenceText: { color: colors.violet, fontSize: 11, fontFamily: fonts.sansBold },
  trash: { padding: 4 },
  empty: { color: colors.textMuted, fontSize: 13, lineHeight: 19, fontFamily: fonts.sans, textAlign: 'center', paddingVertical: spacing.lg },
  clearBtn: { borderColor: colors.danger, borderWidth: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.dangerBg },
  clearLabel: { color: colors.danger, fontSize: 14, fontFamily: fonts.sansBold },
  footer: { textAlign: 'center', color: colors.textMuted, fontSize: 12, lineHeight: 19, fontFamily: fonts.sans },
  segment: { flexDirection: 'row', marginLeft: 'auto', backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  segmentBtn: { paddingHorizontal: spacing.md, paddingVertical: 6 },
  segmentBtnActive: { backgroundColor: colors.violet },
  segmentText: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.sansSemibold },
  segmentTextActive: { color: colors.white },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: spacing.xl },
  modalCard: { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, width: '80%' },
});
