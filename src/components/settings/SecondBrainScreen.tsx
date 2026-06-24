import { useState, useMemo, useEffect } from 'react';
import {
  View, ScrollView, Text, Pressable, StyleSheet, Switch, Alert,
  Modal, TextInput,
} from 'react-native';
import { Graph3D } from '@/components/secondbrain/Graph3D';
import { GraphErrorBoundary } from '@/components/secondbrain/GraphErrorBoundary';
import { toGraphData, CATEGORY_COLORS } from '@/components/secondbrain/graphData';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Trash2, Plus, Maximize2, X, Sparkles } from 'lucide-react-native';
import { useMemoryStore } from '@/secondbrain/MemoryStore';
import { MemoryCategory, MemoryEntry, MEMORY_CATEGORIES } from '@/secondbrain/types';
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
  // ─── Store selectors ───────────────────────────────────────────────────────
  const enabled = useMemoryStore((s) => s.enabled);
  const setEnabled = useMemoryStore((s) => s.setEnabled);
  const entries = useMemoryStore((s) => s.memory.entries);
  const lastExtractionAt = useMemoryStore((s) => s.memory.lastExtractionAt);
  const totalAnalyzed = useMemoryStore((s) => s.memory.totalConversationsAnalyzed);
  const deleteEntry = useMemoryStore((s) => s.deleteEntry);
  const clearAll = useMemoryStore((s) => s.clearAll);
  const updateEntry = useMemoryStore((s) => s.updateEntry);
  const addManualEntry = useMemoryStore((s) => s.addManualEntry);
  const purgeStale = useMemoryStore((s) => s.purgeStale);
  const edges = useMemoryStore((s) => s.memory.edges);
  const recentKeys = useMemoryStore((s) => s.recentKeys);
  const clearRecentKeys = useMemoryStore((s) => s.clearRecentKeys);

  // ─── View / UI state ──────────────────────────────────────────────────────
  const [view, setView] = useState<'graph' | 'list'>('graph');

  // Stop highlighting "new" nodes once the user has seen them (on leave).
  useEffect(() => () => clearRecentKeys(), [clearRecentKeys]);
  const recentSet = useMemo(() => new Set(recentKeys), [recentKeys]);

  // Search + filter
  const [query, setQuery] = useState('');
  const [activeCats, setActiveCats] = useState<Set<MemoryCategory>>(new Set());

  // Edit modal
  const [selected, setSelected] = useState<MemoryEntry | null>(null);
  const [draft, setDraft] = useState('');

  // Fullscreen graph modal
  const [fullscreen, setFullscreen] = useState(false);

  // Add fact modal
  const [addOpen, setAddOpen] = useState(false);
  const [addCat, setAddCat] = useState<MemoryCategory>('context');
  const [addKey, setAddKey] = useState('');
  const [addVal, setAddVal] = useState('');

  // ─── Derived data ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      const catMatch = activeCats.size === 0 || activeCats.has(e.category);
      const textMatch = !q || e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [entries, activeCats, query]);

  const graphData = useMemo(() => toGraphData(filtered, edges ?? [], recentSet), [filtered, edges, recentSet]);
  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  // Categories that have at least 1 entry (for chip rendering)
  const activeCategories = useMemo(() => {
    const counts = new Map<MemoryCategory, number>();
    entries.forEach((e) => counts.set(e.category, (counts.get(e.category) ?? 0) + 1));
    return MEMORY_CATEGORIES.filter((c) => counts.has(c)).map((c) => ({ cat: c, count: counts.get(c)! }));
  }, [entries]);

  const staleCount = useMemo(() => entries.filter((e) => e.stale).length, [entries]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const openEdit = (e: MemoryEntry) => {
    setSelected(e);
    setDraft(e.value);
  };

  const closeEdit = () => {
    setSelected(null);
    setDraft('');
  };

  const saveEdit = () => {
    if (!selected || !draft.trim() || draft.trim() === selected.value) return;
    updateEntry(selected.id, { value: draft.trim() });
    closeEdit();
  };

  const deleteSelected = () => {
    if (!selected) return;
    deleteEntry(selected.id);
    closeEdit();
  };

  const onNodeTap = (key: string) => {
    const e = entries.find((x) => x.key === key);
    if (e) openEdit(e);
  };

  const toggleCat = (cat: MemoryCategory) => {
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const submitAdd = () => {
    if (!addKey.trim() || !addVal.trim()) return;
    addManualEntry({ category: addCat, key: addKey.trim(), value: addVal.trim() });
    setAddOpen(false);
    setAddKey('');
    setAddVal('');
    setAddCat('context');
  };

  const closeAdd = () => {
    setAddOpen(false);
    setAddKey('');
    setAddVal('');
    setAddCat('context');
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

  // ─── Render ───────────────────────────────────────────────────────────────
  const hasEntries = entries.length > 0;

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      {/* ── Header ── */}
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
          Aether's memory of you — learned automatically after every message, fully private, stored only on this device.
        </Text>

        {/* ── Enable card ── */}
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Enable Second Brain</Text>
              <Text style={styles.toggleHint}>
                On: every message is analysed automatically and memories are used in all chats. Off: nothing is learned or used.
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

        {/* ── New-memory banner (after a chat just taught Aether something) ── */}
        {recentKeys.length > 0 && (
          <View style={styles.recentBanner}>
            <Sparkles size={16} color={colors.violet} strokeWidth={2.4} />
            <Text style={styles.recentText}>
              {recentKeys.length} new {recentKeys.length === 1 ? 'memory' : 'memories'} from your last chat — glowing in the graph below.
            </Text>
          </View>
        )}

        {/* ── Status card ── */}
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

        {/* ── Empty state ── */}
        {!hasEntries ? (
          <Text style={styles.empty}>
            Nothing learned yet. Keep chatting — Aether will quietly build a picture of you.
          </Text>
        ) : (
          <>
            {/* ── Search + Add row ── */}
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search memories…"
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                clearButtonMode="while-editing"
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable style={styles.addFactBtn} onPress={() => setAddOpen(true)} hitSlop={4}>
                <Plus size={15} color={colors.violet} strokeWidth={2.5} />
                <Text style={styles.addFactLabel}>Add fact</Text>
              </Pressable>
            </View>

            {/* ── Category filter chips (legend) ── */}
            <View style={styles.chipsWrap}>
              {activeCategories.map(({ cat, count }) => {
                const isActive = activeCats.has(cat);
                return (
                  <Pressable
                    key={cat}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => toggleCat(cat)}
                  >
                    <View style={[styles.chipDot, { backgroundColor: CATEGORY_COLORS[cat] }]} />
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {cat}
                    </Text>
                    <Text style={[styles.chipCount, isActive && styles.chipCountActive]}>
                      {count}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* ── Graph or List ── */}
            {view === 'graph' ? (
              <View style={styles.graphContainer}>
                <GraphErrorBoundary>
                  <Graph3D
                    data={graphData}
                    onNodeTap={onNodeTap}
                    focusKey={selected?.key ?? null}
                  />
                </GraphErrorBoundary>
                <Pressable
                  style={styles.expandBtn}
                  onPress={() => setFullscreen(true)}
                  hitSlop={4}
                >
                  <Maximize2 size={16} color={colors.text} strokeWidth={2} />
                </Pressable>
              </View>
            ) : (
              grouped.length === 0 ? (
                <Text style={styles.empty}>No entries match your search.</Text>
              ) : (
                grouped.map(([category, list]) => (
                  <View key={category}>
                    <Text style={styles.label}>{category}</Text>
                    {list.map((e) => (
                      <Pressable key={e.id} style={styles.entryRow} onPress={() => openEdit(e)}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.entryKey}>{e.key}</Text>
                          <Text style={styles.entryValue}>{e.value}</Text>
                        </View>
                        <View style={styles.confidence}>
                          <Text style={styles.confidenceText}>{Math.round(e.confidence * 100)}%</Text>
                        </View>
                        <Pressable
                          onPress={(ev) => { ev.stopPropagation(); deleteEntry(e.id); }}
                          hitSlop={8}
                          style={styles.trash}
                        >
                          <Trash2 size={18} color={colors.textMuted} />
                        </Pressable>
                      </Pressable>
                    ))}
                  </View>
                ))
              )
            )}

            {/* ── Clear all + Purge stale ── */}
            <View style={styles.dangerRow}>
              {staleCount > 0 && (
                <Pressable style={styles.purgeBtn} onPress={purgeStale}>
                  <Text style={styles.purgeLabel}>Clear stale ({staleCount})</Text>
                </Pressable>
              )}
              <Pressable style={styles.clearBtn} onPress={confirmClear}>
                <Text style={styles.clearLabel}>Clear all memory</Text>
              </Pressable>
            </View>
          </>
        )}

        <Text style={styles.footer}>
          Memory is extracted on-device by your local model.{'\n'}Nothing is ever sent to a server.
        </Text>
      </ScrollView>

      {/* ═══ Edit / View fact modal ═══════════════════════════════════════════ */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={closeEdit}>
        <Pressable style={styles.modalBackdrop} onPress={closeEdit}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {selected && (
              <>
                <View style={styles.modalCatRow}>
                  <View style={[styles.chipDot, { backgroundColor: CATEGORY_COLORS[selected.category] }]} />
                  <Text style={styles.label}>{selected.category}</Text>
                </View>
                <Text style={styles.entryKey}>{selected.key}</Text>
                <TextInput
                  style={styles.editInput}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  placeholder="Value…"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
                <Text style={[styles.confidenceText, { marginTop: 8 }]}>
                  {Math.round(selected.confidence * 100)}% confident{selected.stale ? ' · stale' : ''}
                </Text>
                <View style={styles.modalActions}>
                  <Pressable style={styles.modalBtnCancel} onPress={closeEdit}>
                    <Text style={styles.modalBtnCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.modalBtnDelete} onPress={deleteSelected}>
                    <Trash2 size={14} color={colors.danger} strokeWidth={2} />
                    <Text style={styles.modalBtnDeleteText}>Delete</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalBtnSave, (!draft.trim() || draft.trim() === selected.value) && styles.modalBtnDisabled]}
                    onPress={saveEdit}
                    disabled={!draft.trim() || draft.trim() === selected.value}
                  >
                    <Text style={styles.modalBtnSaveText}>Save</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══ Add fact modal ════════════════════════════════════════════════════ */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={closeAdd}>
        <Pressable style={styles.modalBackdrop} onPress={closeAdd}>
          <Pressable style={[styles.modalCard, styles.addModalCard]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add a fact</Text>
              <Pressable onPress={closeAdd} hitSlop={8}>
                <X size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.label, { marginBottom: spacing.sm }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              <View style={styles.chipsWrap}>
                {MEMORY_CATEGORIES.map((cat) => {
                  const isSel = addCat === cat;
                  return (
                    <Pressable
                      key={cat}
                      style={[styles.chip, isSel && styles.chipActive]}
                      onPress={() => setAddCat(cat)}
                    >
                      <View style={[styles.chipDot, { backgroundColor: CATEGORY_COLORS[cat] }]} />
                      <Text style={[styles.chipText, isSel && styles.chipTextActive]}>{cat}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={[styles.label, { marginBottom: spacing.sm }]}>Key</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="e.g. favorite_color"
              placeholderTextColor={colors.textMuted}
              value={addKey}
              onChangeText={setAddKey}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={[styles.label, { marginTop: spacing.md, marginBottom: spacing.sm }]}>Value</Text>
            <TextInput
              style={[styles.editInput, { marginBottom: 0 }]}
              placeholder="The fact to remember…"
              placeholderTextColor={colors.textMuted}
              value={addVal}
              onChangeText={setAddVal}
              multiline
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtnCancel} onPress={closeAdd}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtnSave, (!addKey.trim() || !addVal.trim()) && styles.modalBtnDisabled]}
                onPress={submitAdd}
                disabled={!addKey.trim() || !addVal.trim()}
              >
                <Text style={styles.modalBtnSaveText}>Add</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══ Fullscreen graph modal ════════════════════════════════════════════ */}
      <Modal visible={fullscreen} transparent={false} animationType="slide" onRequestClose={() => setFullscreen(false)}>
        <SafeAreaView style={styles.fullscreenModal} edges={['top', 'bottom']}>
          <View style={styles.fullscreenHeader}>
            <Text style={styles.title}>Second Brain</Text>
            <Pressable onPress={() => setFullscreen(false)} hitSlop={8} style={styles.closeBtn}>
              <X size={20} color={colors.text} strokeWidth={2} />
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <GraphErrorBoundary>
              <Graph3D data={graphData} onNodeTap={onNodeTap} focusKey={selected?.key ?? null} />
            </GraphErrorBoundary>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  back: { fontSize: 28, color: colors.text, lineHeight: 30 },
  title: { color: colors.text, fontSize: 20, fontFamily: fonts.displayBold, flex: 1 },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, fontFamily: fonts.sans },

  // Flat sections — no card, no border (Claude-style on black).
  card: { paddingVertical: spacing.xs },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  toggleLabel: { color: colors.text, fontSize: 15, fontFamily: fonts.display },
  toggleHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, fontFamily: fonts.sans, marginTop: 3 },

  // New-memory banner — subtle violet wash, no border.
  recentBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.violetDim, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.md },
  recentText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 18, fontFamily: fonts.sansMedium },

  // Status card
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  statusLabel: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.sans },
  statusValue: { color: colors.text, fontSize: 13, fontFamily: fonts.sansMedium },

  // Segment control
  segment: { flexDirection: 'row', marginLeft: 'auto', backgroundColor: colors.bgInput, borderRadius: radius.md, overflow: 'hidden' },
  segmentBtn: { paddingHorizontal: spacing.md, paddingVertical: 6 },
  segmentBtnActive: { backgroundColor: colors.violet },
  segmentText: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.sansSemibold },
  segmentTextActive: { color: colors.white },

  // Search + add row
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchInput: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.sans,
  },
  addFactBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.full, borderWidth: 1, borderColor: colors.violet, backgroundColor: colors.bgCard },
  addFactLabel: { color: colors.violet, fontSize: 13, fontFamily: fonts.sansSemibold },

  // Category chips
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.bgInput },
  chipActive: { backgroundColor: colors.violetDim },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.sansSemibold },
  chipTextActive: { color: colors.violet },
  chipCount: { color: colors.textMuted, fontSize: 10, fontFamily: fonts.sans },
  chipCountActive: { color: colors.violet },

  // Graph container
  graphContainer: { height: 420, borderRadius: radius.lg, overflow: 'hidden' },
  graphFallback: { flex: 1, backgroundColor: colors.bg },
  expandBtn: { position: 'absolute', top: spacing.sm, right: spacing.sm, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.sm, padding: 7 },

  // List rows — flat, separated by a hairline.
  label: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.md, fontFamily: fonts.sansSemibold },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.separator },
  entryKey: { color: colors.text, fontSize: 15, fontFamily: fonts.display },
  entryValue: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.sans, marginTop: 2 },
  confidence: { paddingHorizontal: spacing.xs, paddingVertical: 3 },
  confidenceText: { color: colors.violet, fontSize: 11, fontFamily: fonts.sansBold },
  trash: { padding: 4 },

  // Empty state
  empty: { color: colors.textMuted, fontSize: 13, lineHeight: 19, fontFamily: fonts.sans, textAlign: 'center', paddingVertical: spacing.lg },

  // Danger row (clear + purge)
  dangerRow: { gap: spacing.sm },
  clearBtn: { borderColor: colors.danger, borderWidth: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.dangerBg },
  clearLabel: { color: colors.danger, fontSize: 14, fontFamily: fonts.sansBold },
  purgeBtn: { borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.bgInput },
  purgeLabel: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.sansSemibold },

  // Footer
  footer: { textAlign: 'center', color: colors.textMuted, fontSize: 12, lineHeight: 19, fontFamily: fonts.sans },

  // Edit modal
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: spacing.xl },
  modalCard: { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, width: '90%' },
  addModalCard: { width: '95%', maxHeight: '85%' },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.displayBold },
  modalCatRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  editInput: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.sans,
    minHeight: 72,
    textAlignVertical: 'top',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, justifyContent: 'flex-end' },
  modalBtnCancel: { paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  modalBtnCancelText: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.sansSemibold },
  modalBtnDelete: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.dangerBg },
  modalBtnDeleteText: { color: colors.danger, fontSize: 13, fontFamily: fonts.sansSemibold },
  modalBtnSave: { paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.md, backgroundColor: colors.violet },
  modalBtnSaveText: { color: colors.white, fontSize: 13, fontFamily: fonts.sansBold },
  modalBtnDisabled: { opacity: 0.4 },

  // Fullscreen graph modal
  fullscreenModal: { flex: 1, backgroundColor: colors.bg },
  fullscreenHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14 },
  closeBtn: { marginLeft: 'auto' },
});
