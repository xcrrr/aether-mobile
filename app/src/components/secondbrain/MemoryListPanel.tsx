import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, ScrollView, Text, Pressable, StyleSheet, Switch, Alert,
  Modal, TextInput, Animated, Easing, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2, Plus, X } from 'lucide-react-native';
import { CATEGORY_COLORS } from '@/components/secondbrain/graphData';
import { useMemoryStore } from '@/secondbrain/MemoryStore';
import { useChatStore } from '@/state/useChatStore';
import { MemoryCategory, MemoryEntry, MEMORY_CATEGORIES } from '@/secondbrain/types';
import { spacing, fonts, radius, Palette, fontSize, motion, shadow, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

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

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return 'High confidence';
  if (confidence >= 0.75) return 'Medium confidence';
  return 'Low confidence';
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Open the shared edit modal (owned by the screen) for a given entry. */
  onOpenEntry: (e: MemoryEntry) => void;
}

/**
 * The Second Brain list + management surface, slid in over the graph. Owns
 * search/filter, the add-fact modal, and the enable/status/danger controls.
 * Editing a single fact is delegated to the screen's shared edit modal so a node
 * tap in the graph and a list-row tap open the same editor.
 */
export function MemoryListPanel({ open, onClose, onOpenEntry }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const PANEL_W = useMemo(() => Math.min(440, Dimensions.get('window').width * 0.92), []);

  const tx = useRef(new Animated.Value(PANEL_W)).current;
  const [rendered, setRendered] = useState(open);

  useEffect(() => {
    if (open) {
      setRendered(true);
      Animated.timing(tx, {
        toValue: 0, duration: motion.durBase, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(tx, {
        toValue: PANEL_W, duration: motion.durFast, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }).start(({ finished }) => finished && setRendered(false));
    }
  }, [open, tx, PANEL_W]);

  const chatIndex = useChatStore((s) => s.index);
  const enabled = useMemoryStore((s) => s.enabled);
  const setEnabled = useMemoryStore((s) => s.setEnabled);
  const entries = useMemoryStore((s) => s.memory.entries);
  const lastExtractionAt = useMemoryStore((s) => s.memory.lastExtractionAt);
  const totalAnalyzed = useMemoryStore((s) => s.memory.totalConversationsAnalyzed);
  const deleteEntry = useMemoryStore((s) => s.deleteEntry);
  const clearAll = useMemoryStore((s) => s.clearAll);
  const addManualEntry = useMemoryStore((s) => s.addManualEntry);
  const purgeStale = useMemoryStore((s) => s.purgeStale);

  const [query, setQuery] = useState('');
  const [activeCats, setActiveCats] = useState<Set<MemoryCategory>>(new Set());

  const [addOpen, setAddOpen] = useState(false);
  const [addCat, setAddCat] = useState<MemoryCategory>('context');
  const [addKey, setAddKey] = useState('');
  const [addVal, setAddVal] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      const catMatch = activeCats.size === 0 || activeCats.has(e.category);
      const textMatch = !q || e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [entries, activeCats, query]);

  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  const activeCategories = useMemo(() => {
    const counts = new Map<MemoryCategory, number>();
    entries.forEach((e) => counts.set(e.category, (counts.get(e.category) ?? 0) + 1));
    return MEMORY_CATEGORIES.filter((cat) => counts.has(cat)).map((cat) => ({ cat, count: counts.get(cat)! }));
  }, [entries]);

  const staleCount = useMemo(() => entries.filter((e) => e.stale).length, [entries]);

  const titleByConversation = useMemo(() => {
    const map = new Map<string, string>();
    chatIndex.forEach((m) => map.set(m.id, m.title));
    return map;
  }, [chatIndex]);

  const sourceLabel = (e: MemoryEntry): string => {
    const saved = `Saved ${formatTime(e.lastSeenAt || e.updatedAt || e.createdAt)}`;
    if (e.sourceConversationId === 'manual') return `${saved} / manual`;
    const title = titleByConversation.get(e.sourceConversationId);
    return title ? `${saved} / ${title}` : saved;
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
    closeAdd();
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

  if (!rendered) return null;

  const backdropOpacity = tx.interpolate({ inputRange: [0, PANEL_W], outputRange: [1, 0] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          { width: PANEL_W, paddingTop: insets.top + spacing.md, transform: [{ translateX: tx }] },
        ]}
      >
        <View style={styles.panelHeader}>
          <Text style={styles.title}>Memories</Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <X size={20} color={c.text} strokeWidth={2} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          {/* Search + Add row */}
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search memories..."
              placeholderTextColor={c.textMuted}
              value={query}
              onChangeText={setQuery}
              clearButtonMode="while-editing"
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable style={styles.addFactBtn} onPress={() => setAddOpen(true)} hitSlop={4}>
              <Plus size={15} color={c.textMuted} strokeWidth={2.2} />
              <Text style={styles.addFactLabel}>Add fact</Text>
            </Pressable>
          </View>

          {/* Category filter chips */}
          {activeCategories.length > 0 && (
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
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{cat}</Text>
                    <Text style={[styles.chipCount, isActive && styles.chipCountActive]}>{count}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* List */}
          {entries.length === 0 ? (
            <Text style={styles.empty}>
              Nothing saved yet. When useful details appear in chat, Aether can keep them here.
            </Text>
          ) : grouped.length === 0 ? (
            <Text style={styles.empty}>No entries match your search.</Text>
          ) : (
            grouped.map(([category, list]) => (
              <View key={category}>
                <Text style={styles.label}>{category}</Text>
                {list.map((e) => (
                  <Pressable key={e.id} style={styles.entryRow} onPress={() => onOpenEntry(e)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryKey}>{e.key}</Text>
                      <Text style={styles.entryValue}>{e.value}</Text>
                      <Text style={styles.entryMeta} numberOfLines={1}>{sourceLabel(e)}</Text>
                    </View>
                    <View style={styles.confidence}>
                      <Text style={styles.confidenceText}>{confidenceLabel(e.confidence)}</Text>
                    </View>
                    <Pressable
                      onPress={(ev) => { ev.stopPropagation(); deleteEntry(e.id); }}
                      hitSlop={8}
                      style={styles.trash}
                    >
                      <Trash2 size={18} color={c.textMuted} />
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            ))
          )}

          {/* Clear all + Purge stale */}
          {entries.length > 0 && (
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
          )}

          {/* Enable Core */}
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Enable Core</Text>
                <Text style={styles.toggleHint}>
                  On: important things you say are remembered and used in all chats. Off: nothing is learned or used.
                </Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ false: c.border, true: c.violet }}
                thumbColor={c.white}
              />
            </View>
          </View>

          {/* Status */}
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

          <Text style={styles.footer}>
            Memory is extracted by your local model and stays editable here.
          </Text>
        </ScrollView>
      </Animated.View>

      {/* Add fact modal */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={closeAdd}>
        <Pressable style={styles.modalBackdrop} onPress={closeAdd}>
          <Pressable style={[styles.modalCard, styles.addModalCard]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add a fact</Text>
              <Pressable onPress={closeAdd} hitSlop={8}>
                <X size={18} color={c.textMuted} />
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
              placeholderTextColor={c.textMuted}
              value={addKey}
              onChangeText={setAddKey}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={[styles.label, { marginTop: spacing.md, marginBottom: spacing.sm }]}>Value</Text>
            <TextInput
              style={[styles.editInput, { marginBottom: 0 }]}
              placeholder="The fact to remember..."
              placeholderTextColor={c.textMuted}
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
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: {
    position: 'absolute', top: 0, bottom: 0, right: 0,
    backgroundColor: c.bg, borderLeftWidth: 1, borderLeftColor: c.border,
    ...shadow.lg,
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  title: { color: c.text, flex: 1, ...typography.screenTitle },
  closeBtn: { marginLeft: 'auto', width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  card: { paddingVertical: spacing.xs },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  toggleLabel: { color: c.text, ...typography.sectionTitle },
  toggleHint: { color: c.textMuted, fontSize: fontSize.sm, lineHeight: 17, fontFamily: fonts.sans, marginTop: 3 },

  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  statusLabel: { color: c.textMuted, fontSize: fontSize.sm2, fontFamily: fonts.sans },
  statusValue: { color: c.text, fontSize: fontSize.sm2, fontFamily: fonts.sansMedium },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchInput: {
    flex: 1, backgroundColor: c.bgInput, borderRadius: radius.md, borderWidth: 1, borderColor: c.border,
    paddingHorizontal: spacing.md, paddingVertical: 9, color: c.text, fontSize: fontSize.base, fontFamily: fonts.sans,
  },
  addFactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 9,
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard,
  },
  addFactLabel: { color: c.text, fontSize: fontSize.sm2, fontFamily: fonts.sansSemibold },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.sm, backgroundColor: c.bgInput, borderWidth: 1, borderColor: c.border,
  },
  chipActive: { backgroundColor: c.violetDim },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.sansSemibold },
  chipTextActive: { color: c.violet },
  chipCount: { color: c.textMuted, fontSize: fontSize.micro, fontFamily: fonts.sans },
  chipCountActive: { color: c.violet },

  label: { color: c.textMuted, fontSize: fontSize.xs, textTransform: 'uppercase', marginBottom: spacing.md, fontFamily: fonts.sansSemibold },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.separator },
  entryKey: { color: c.text, ...typography.label },
  entryValue: { color: c.textMuted, fontSize: fontSize.sm2, fontFamily: fonts.sans, marginTop: 2 },
  entryMeta: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.sans, marginTop: spacing.xs },
  confidence: { paddingHorizontal: spacing.xs, paddingVertical: 3 },
  confidenceText: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.sansSemibold },
  trash: { padding: spacing.xs },

  empty: { color: c.textMuted, fontSize: fontSize.sm2, lineHeight: 19, fontFamily: fonts.sans, textAlign: 'center', paddingVertical: spacing.lg },

  dangerRow: { gap: spacing.sm },
  clearBtn: { borderColor: c.danger, borderWidth: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', backgroundColor: c.dangerBg },
  clearLabel: { color: c.danger, ...typography.button },
  purgeBtn: { borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', backgroundColor: c.bgInput },
  purgeLabel: { color: c.textMuted, fontSize: fontSize.sm2, fontFamily: fonts.sansSemibold },

  footer: { textAlign: 'center', color: c.textMuted, fontSize: fontSize.sm, lineHeight: 19, fontFamily: fonts.sans },

  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: spacing.xl },
  modalCard: { backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.lg, width: '90%' },
  addModalCard: { width: '95%', maxHeight: '85%' },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  modalTitle: { color: c.text, ...typography.sectionTitle },
  editInput: {
    backgroundColor: c.bg, borderColor: c.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md,
    color: c.text, fontSize: fontSize.base, fontFamily: fonts.sans, minHeight: 72, textAlignVertical: 'top',
    marginTop: spacing.sm, marginBottom: spacing.sm,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, justifyContent: 'flex-end' },
  modalBtnCancel: { paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.md, borderWidth: 1, borderColor: c.border },
  modalBtnCancelText: { color: c.textMuted, fontSize: fontSize.sm2, fontFamily: fonts.sansSemibold },
  modalBtnSave: { paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.md, backgroundColor: c.violet },
  modalBtnSaveText: { color: c.white, ...typography.label },
  modalBtnDisabled: { opacity: 0.4 },
});
