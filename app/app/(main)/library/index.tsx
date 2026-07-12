import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { PressableScale } from '@/components/ds/PressableScale';
import { useLibraryStore } from '@/state/useLibraryStore';
import { typeLabel } from '@/library/artifact';
import { AgentArtifact } from '@/agent/types';
import { spacing, Palette, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LibraryIndex() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const items = useLibraryStore((s) => s.items);

  const sorted = useMemo(
    () => [...items].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt)),
    [items],
  );

  const renderItem = ({ item }: { item: AgentArtifact }) => (
    <PressableScale style={styles.row} onPress={() => router.push(`/(main)/library/${item.id}`)} scaleTo={0.99}>
      <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.rowMeta}>
        {typeLabel(item)} · {formatDate(item.updatedAt ?? item.createdAt)} · From Task
      </Text>
    </PressableScale>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <ChevronLeft size={24} color={c.text} strokeWidth={1.8} />
        </PressableScale>
        <Text style={styles.title}>Library</Text>
      </View>

      {sorted.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No saved work yet.</Text>
          <Text style={styles.emptySub}>Keep a Task result and it will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    borderBottomWidth: 1,
    borderBottomColor: c.separator,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { color: c.text, ...typography.screenTitle },
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.separator,
  },
  rowTitle: { color: c.text, ...typography.sectionTitle },
  rowMeta: { color: c.textMuted, ...typography.metadata, marginTop: spacing.xs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.xs },
  emptyTitle: { color: c.text, ...typography.sectionTitle },
  emptySub: { color: c.textMuted, ...typography.body, textAlign: 'center' },
});
