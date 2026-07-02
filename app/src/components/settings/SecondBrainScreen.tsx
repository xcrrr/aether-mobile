import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, ExternalLink, List, Locate, Pencil, Search, Trash2, X } from 'lucide-react-native';
import { PressableScale } from '@/components/ds/PressableScale';
import { MemoryGraphView, MemoryGraphViewHandle } from '@/components/secondbrain/MemoryGraphView';
import { MemoryListPanel } from '@/components/secondbrain/MemoryListPanel';
import { GraphErrorBoundary } from '@/components/secondbrain/GraphErrorBoundary';
import {
  GraphLink,
  GraphNode,
  VISUAL_CATEGORY_COLORS,
  VISUAL_CATEGORY_LABELS,
  connectionExplanation,
  toGraphData,
} from '@/components/secondbrain/graphData';
import { useMemoryStore } from '@/secondbrain/MemoryStore';
import { useChatStore } from '@/state/useChatStore';
import {
  MEMORY_VISUAL_CATEGORIES,
  MemoryEntry,
  MemoryVisualCategory,
} from '@/secondbrain/types';
import { spacing, fonts, radius, Palette, fontSize, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

const GRAPH_BG = '#181818';
const OVER_TEXT = '#F7F3FB';
const OVER_MUTED = 'rgba(225,219,232,0.68)';

function SearchSheet({
  open,
  query,
  setQuery,
  results,
  onClose,
  onSelect,
}: {
  open: boolean;
  query: string;
  setQuery: (value: string) => void;
  results: GraphNode[];
  onClose: () => void;
  onSelect: (node: GraphNode) => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.searchBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.searchPanel, { paddingTop: insets.top + spacing.lg }]}>
          <View style={styles.searchHeader}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search memories, people, projects..."
              placeholderTextColor={c.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            <PressableScale onPress={onClose} hitSlop={8} style={styles.sheetIconBtn}>
              <X size={20} color={c.text} strokeWidth={2} />
            </PressableScale>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.resultsContent}
          >
            {results.length === 0 ? (
              <Text style={styles.emptyResult}>{query.trim() ? 'No matching context.' : 'Type to search your connected context.'}</Text>
            ) : results.map((node) => (
              <PressableScale key={node.id} style={styles.resultRow} onPress={() => onSelect(node)} scaleTo={0.985}>
                <View style={[styles.resultDot, { backgroundColor: VISUAL_CATEGORY_COLORS[node.category] }]} />
                <View style={styles.resultTextWrap}>
                  <Text style={styles.resultTitle} numberOfLines={1}>{node.title}</Text>
                  <Text style={styles.resultMeta} numberOfLines={1}>
                    {node.categoryLabel} - {node.connectionCount} connected
                  </Text>
                </View>
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function formatDay(ms: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function DetailSheet({
  node,
  entry,
  links,
  nodeById,
  sourceTitle,
  onClose,
  onCategory,
  onOpenSource,
  onEdit,
  onDelete,
  onHeight,
}: {
  node: GraphNode;
  entry: MemoryEntry;
  links: GraphLink[];
  nodeById: Map<string, GraphNode>;
  sourceTitle: string | null;
  onClose: () => void;
  onCategory: (category: MemoryVisualCategory) => void;
  onOpenSource: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onHeight: (h: number) => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const related = links
    .map((link) => {
      const source = typeof link.source === 'string' ? link.source : String(link.source);
      const target = typeof link.target === 'string' ? link.target : String(link.target);
      const otherId = source === node.id ? target : source;
      const other = nodeById.get(otherId);
      return other ? { node: other, link } : null;
    })
    .filter((item): item is { node: GraphNode; link: GraphLink } => !!item)
    .sort((a, b) => b.link.relationshipStrength - a.link.relationshipStrength)
    .slice(0, 4);
  const strongest = related[0];
  const previous = entry.history?.[0];

  const savedLine = [
    entry.sourceConversationId === 'manual' ? 'Added by you' : sourceTitle ? `From "${sourceTitle}"` : 'From a deleted chat',
    formatDay(entry.updatedAt || entry.createdAt),
  ].filter(Boolean).join(' - ');

  return (
    <View
      style={[styles.detailSheet, { paddingBottom: insets.bottom + spacing.md }]}
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
    >
      <View style={styles.sheetGrip} />
      <View style={styles.detailHeader}>
        <View style={styles.detailTitleWrap}>
          <Text style={styles.detailTitle} numberOfLines={2}>{node.title}</Text>
          <Text style={styles.detailMeta}>
            {node.categoryLabel} - {node.connectionCount} connected - {savedLine}
          </Text>
        </View>
        <PressableScale onPress={onClose} hitSlop={8} style={styles.sheetIconBtn}>
          <X size={18} color={c.textMuted} strokeWidth={2} />
        </PressableScale>
      </View>

      <Text style={styles.sheetLabel}>Why this was saved</Text>
      {entry.evidence ? (
        <>
          <Text style={styles.evidence} numberOfLines={3}>{'“'}{entry.evidence}{'”'}</Text>
          {entry.reason ? <Text style={styles.because}>{entry.reason}.</Text> : null}
        </>
      ) : (
        <Text style={styles.because}>
          {entry.sourceConversationId === 'manual'
            ? 'You added this memory yourself.'
            : 'Saved before evidence tracking; the original quote was not recorded.'}
        </Text>
      )}

      {previous && (
        <>
          <Text style={styles.sheetLabel}>Previously</Text>
          <Text style={styles.because}>
            {'“'}{previous.value}{'”'} - until {formatDay(previous.replacedAt)}
          </Text>
        </>
      )}

      <Text style={styles.sheetLabel}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        {MEMORY_VISUAL_CATEGORIES.map((category) => {
          const active = node.category === category;
          return (
            <PressableScale
              key={category}
              style={[styles.categoryChip, active && styles.categoryChipActive]}
              onPress={() => onCategory(category)}
              scaleTo={0.97}
            >
              <View style={[styles.categoryDot, { backgroundColor: VISUAL_CATEGORY_COLORS[category] }]} />
              <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                {VISUAL_CATEGORY_LABELS[category]}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      {related.length > 0 && strongest && (
        <>
          <Text style={styles.sheetLabel}>Connected to</Text>
          <View style={styles.relatedWrap}>
            {related.map(({ node: relatedNode }) => (
              <View key={relatedNode.id} style={styles.relatedPill}>
                <View style={[styles.relatedDot, { backgroundColor: VISUAL_CATEGORY_COLORS[relatedNode.category] }]} />
                <Text style={styles.relatedText} numberOfLines={1}>{relatedNode.label}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.because, { marginTop: spacing.sm }]}>
            {connectionExplanation(node, strongest.node, strongest.link)}
          </Text>
        </>
      )}

      <View style={styles.actionsRow}>
        <PressableScale style={styles.secondaryAction} onPress={onEdit}>
          <Pencil size={14} color={c.text} strokeWidth={2} />
          <Text style={styles.secondaryActionText}>Edit</Text>
        </PressableScale>
        {entry.sourceConversationId !== 'manual' && (
          <PressableScale style={styles.secondaryAction} onPress={onOpenSource}>
            <ExternalLink size={14} color={c.text} strokeWidth={2} />
            <Text style={styles.secondaryActionText}>Open source</Text>
          </PressableScale>
        )}
        <PressableScale style={[styles.secondaryAction, styles.dangerAction]} onPress={onDelete}>
          <Trash2 size={14} color={c.danger} strokeWidth={2} />
          <Text style={[styles.secondaryActionText, { color: c.danger }]}>Delete</Text>
        </PressableScale>
      </View>
    </View>
  );
}

export default function SecondBrainScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);

  const chatIndex = useChatStore((s) => s.index);
  const currentChatId = useChatStore((s) => s.current?.id ?? null);
  const entries = useMemoryStore((s) => s.memory.entries);
  const edges = useMemoryStore((s) => s.memory.edges);
  const recentKeys = useMemoryStore((s) => s.recentKeys);
  const clearRecentKeys = useMemoryStore((s) => s.clearRecentKeys);
  const updateEntry = useMemoryStore((s) => s.updateEntry);
  const deleteEntry = useMemoryStore((s) => s.deleteEntry);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<MemoryEntry | null>(null);
  const [editValue, setEditValue] = useState('');
  const [sheetHeight, setSheetHeight] = useState(340);
  const graphRef = useRef<MemoryGraphViewHandle>(null);

  useEffect(() => () => clearRecentKeys(), [clearRecentKeys]);
  const recentSet = useMemo(() => new Set(recentKeys), [recentKeys]);
  const graphData = useMemo(() => toGraphData(entries, edges ?? [], recentSet), [entries, edges, recentSet]);

  const nodeById = useMemo(() => new Map(graphData.nodes.map((node) => [node.id, node])), [graphData.nodes]);
  const entryById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const selectedNode = selectedKey ? nodeById.get(selectedKey) ?? null : null;
  const selectedEntry = selectedNode ? entryById.get(selectedNode.entryId) ?? null : null;
  const selectedLinks = useMemo(() => {
    if (!selectedKey) return [];
    return graphData.links.filter((link) => {
      const source = typeof link.source === 'string' ? link.source : String(link.source);
      const target = typeof link.target === 'string' ? link.target : String(link.target);
      return source === selectedKey || target === selectedKey;
    });
  }, [graphData.links, selectedKey]);

  useEffect(() => {
    if (selectedKey && !nodeById.has(selectedKey)) setSelectedKey(null);
  }, [nodeById, selectedKey]);

  useEffect(() => {
    setDetailVisible(!!selectedKey);
  }, [selectedKey]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedKey) {
        setSelectedKey(null);
        setDetailVisible(false);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [selectedKey]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? graphData.nodes.slice().sort((a, b) => b.connectionCount - a.connectionCount || b.importance - a.importance)
      : graphData.nodes.filter((node) => {
        const text = `${node.title} ${node.id} ${node.categoryLabel} ${node.sourceCategory} ${node.semanticKeywords.join(' ')}`.toLowerCase();
        return text.includes(q);
      });
    return list.slice(0, 40);
  }, [graphData.nodes, query]);

  const activeTopics = useMemo(
    () => new Set(graphData.nodes.map((node) => node.category)).size,
    [graphData.nodes],
  );

  const sourceTitle = useMemo(() => {
    if (!selectedEntry || selectedEntry.sourceConversationId === 'manual') return null;
    return chatIndex.find((meta) => meta.id === selectedEntry.sourceConversationId)?.title ?? null;
  }, [chatIndex, selectedEntry]);

  const handleCategory = (category: MemoryVisualCategory) => {
    if (!selectedEntry) return;
    updateEntry(selectedEntry.id, { visualCategory: category });
  };

  const openSource = () => {
    if (!selectedEntry || selectedEntry.sourceConversationId === 'manual') return;
    router.push(`/(main)/chat/${selectedEntry.sourceConversationId}`);
  };

  const selectNode = (node: GraphNode) => {
    setSelectedKey(node.id);
    setDetailVisible(true);
    setSearchOpen(false);
    setQuery('');
  };

  const openEdit = (entry: MemoryEntry) => {
    setEditing(entry);
    setEditValue(entry.value);
  };

  const saveEdit = () => {
    if (editing && editValue.trim()) updateEntry(editing.id, { value: editValue.trim() });
    setEditing(null);
  };

  const confirmDelete = (entry: MemoryEntry) => {
    Alert.alert(
      'Delete this memory?',
      `"${entry.value}" will be removed from your Second Brain, along with its connections.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteEntry(entry.id);
            setSelectedKey(null);
            setDetailVisible(false);
          },
        },
      ],
    );
  };
  const returnToChat = () => {
    const id = currentChatId ?? chatIndex[0]?.id;
    router.replace(id ? `/(main)/chat/${id}` : '/(main)');
  };

  return (
    <View style={styles.root}>
      <GraphErrorBoundary>
        <MemoryGraphView
          ref={graphRef}
          data={graphData}
          overlayTop={insets.top + 64}
          overlayBottom={insets.bottom + (selectedNode && detailVisible ? Math.max(sheetHeight, 280) : 56)}
          onNodeTap={(key) => {
            setSelectedKey(key);
            setDetailVisible(true);
          }}
          onClearFocus={() => {
            setSelectedKey(null);
            setDetailVisible(false);
          }}
          focusKey={selectedKey}
        />
      </GraphErrorBoundary>

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <PressableScale onPress={returnToChat} hitSlop={10} style={styles.iconBtn}>
          <ChevronLeft size={24} color={OVER_TEXT} strokeWidth={1.8} />
        </PressableScale>
        <View style={styles.titleWrap} pointerEvents="none">
          <Text style={styles.title}>Second Brain</Text>
          <Text style={styles.subtitle}>Your connected context</Text>
        </View>
        <PressableScale onPress={() => setSearchOpen(true)} hitSlop={10} style={styles.iconBtn}>
          <Search size={21} color={OVER_TEXT} strokeWidth={2} />
        </PressableScale>
        <PressableScale onPress={() => setListOpen(true)} hitSlop={10} style={styles.iconBtn}>
          <List size={21} color={OVER_TEXT} strokeWidth={2} />
        </PressableScale>
      </View>

      {graphData.nodes.length > 0 && !selectedNode && (
        <PressableScale
          onPress={() => graphRef.current?.resetView()}
          hitSlop={10}
          style={[styles.iconBtn, styles.recenterBtn, { right: spacing.lg, bottom: insets.bottom + spacing.md + 48 }]}
        >
          <Locate size={20} color={OVER_TEXT} strokeWidth={2} />
        </PressableScale>
      )}

      {!selectedNode && graphData.nodes.length > 0 && (
        <View style={[styles.summaryBar, { bottom: insets.bottom + spacing.md }]} pointerEvents="none">
          <Text style={styles.summaryText}>
            {activeTopics} active topics - {graphData.nodes.length} connected memories - {graphData.links.length} relationships
          </Text>
        </View>
      )}

      {recentKeys.length > 0 && (
        <View style={[styles.toast, { top: insets.top + 62 }]} pointerEvents="none">
          <Text style={styles.toastText}>
            {recentKeys.length} new {recentKeys.length === 1 ? 'memory' : 'memories'}
          </Text>
        </View>
      )}

      <SearchSheet
        open={searchOpen}
        query={query}
        setQuery={setQuery}
        results={searchResults}
        onClose={() => setSearchOpen(false)}
        onSelect={selectNode}
      />

      {selectedNode && selectedEntry && detailVisible && (
        <DetailSheet
          node={selectedNode}
          entry={selectedEntry}
          links={selectedLinks}
          nodeById={nodeById}
          sourceTitle={sourceTitle}
          onClose={() => { setDetailVisible(false); setSelectedKey(null); }}
          onCategory={handleCategory}
          onOpenSource={openSource}
          onEdit={() => openEdit(selectedEntry)}
          onDelete={() => confirmDelete(selectedEntry)}
          onHeight={setSheetHeight}
        />
      )}

      <MemoryListPanel
        open={listOpen}
        onClose={() => setListOpen(false)}
        onOpenEntry={(entry) => {
          setListOpen(false);
          openEdit(entry);
        }}
      />

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.editBackdrop} onPress={() => setEditing(null)}>
          <Pressable style={styles.editCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>Edit memory</Text>
              <PressableScale onPress={() => setEditing(null)} hitSlop={8}>
                <X size={18} color={c.textMuted} strokeWidth={2} />
              </PressableScale>
            </View>
            <TextInput
              style={styles.editInput}
              value={editValue}
              onChangeText={setEditValue}
              multiline
              autoFocus
              placeholder="What should Aether remember?"
              placeholderTextColor={c.textMuted}
            />
            <View style={styles.editActions}>
              <PressableScale style={styles.editCancel} onPress={() => setEditing(null)}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </PressableScale>
              <PressableScale
                style={[styles.editSave, !editValue.trim() && { opacity: 0.4 }]}
                onPress={saveEdit}
                haptic
              >
                <Text style={styles.editSaveText}>Save</Text>
              </PressableScale>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: GRAPH_BG },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,18,18,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  recenterBtn: { position: 'absolute' },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { color: OVER_TEXT, ...typography.sectionTitle },
  subtitle: { color: OVER_MUTED, fontSize: fontSize.xs, fontFamily: fonts.sans, marginTop: 1 },
  summaryBar: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(20,20,20,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  summaryText: { color: OVER_MUTED, ...typography.metadata },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(76,68,91,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(180,160,210,0.28)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  toastText: { color: '#F0EAF8', fontSize: fontSize.xs, fontFamily: fonts.sansSemibold },

  searchBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)' },
  searchPanel: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    maxHeight: '82%',
    borderRadius: radius.md,
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  searchInput: {
    flex: 1,
    minHeight: 42,
    backgroundColor: c.bgInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
    color: c.text,
    fontSize: fontSize.base,
    fontFamily: fonts.sans,
  },
  sheetIconBtn: { width: 34, height: 34, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  resultsContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.separator },
  resultDot: { width: 9, height: 9, borderRadius: 5 },
  resultTextWrap: { flex: 1, minWidth: 0 },
  resultTitle: { color: c.text, fontSize: fontSize.body, fontFamily: fonts.sansSemibold },
  resultMeta: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.sans, marginTop: 2 },
  emptyResult: { color: c.textMuted, fontSize: fontSize.sm2, fontFamily: fonts.sans, textAlign: 'center', paddingVertical: spacing.xl },

  detailSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: c.bg,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  sheetGrip: {
    alignSelf: 'center',
    width: 38,
    height: 3,
    borderRadius: radius.full,
    backgroundColor: c.border,
    marginBottom: spacing.md,
  },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  detailTitleWrap: { flex: 1, minWidth: 0 },
  detailTitle: { color: c.text, ...typography.screenTitle },
  detailMeta: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.sans, marginTop: 3 },
  detailSummary: { color: c.textMuted, fontSize: fontSize.sm2, lineHeight: 19, fontFamily: fonts.sans, marginTop: spacing.md },
  sheetLabel: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.sansSemibold, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase' },
  categoryRow: { gap: spacing.sm, paddingRight: spacing.lg },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.bgInput,
  },
  categoryChipActive: { borderColor: c.violet, backgroundColor: c.violetDim },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  categoryText: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.sansSemibold },
  categoryTextActive: { color: c.text },
  relatedWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  relatedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '48%',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: c.bgInput,
  },
  relatedDot: { width: 7, height: 7, borderRadius: 4 },
  relatedText: { color: c.text, fontSize: fontSize.xs, fontFamily: fonts.sansMedium, flexShrink: 1 },
  because: { color: c.textMuted, fontSize: fontSize.sm2, lineHeight: 19, fontFamily: fonts.sans },
  evidence: {
    color: c.text,
    fontSize: fontSize.sm2,
    lineHeight: 20,
    fontFamily: fonts.serifItalic,
    marginBottom: spacing.xs,
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  secondaryActionText: { color: c.text, fontSize: fontSize.sm2, fontFamily: fonts.sansSemibold },
  dangerAction: { borderColor: c.danger, backgroundColor: c.dangerBg },

  editBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: spacing.xl },
  editCard: {
    width: '100%',
    backgroundColor: c.bgCard,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  editHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  editTitle: { color: c.text, ...typography.sectionTitle },
  editInput: {
    backgroundColor: c.bg,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    color: c.text,
    fontSize: fontSize.base,
    fontFamily: fonts.sans,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  editActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, justifyContent: 'flex-end' },
  editCancel: { paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.md, borderWidth: 1, borderColor: c.border },
  editCancelText: { color: c.textMuted, fontSize: fontSize.sm2, fontFamily: fonts.sansSemibold },
  editSave: { paddingHorizontal: spacing.lg, paddingVertical: 9, borderRadius: radius.md, backgroundColor: c.violet },
  editSaveText: { color: c.white, ...typography.label },
});
