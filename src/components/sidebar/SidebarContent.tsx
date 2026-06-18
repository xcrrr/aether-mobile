import { View, Text, Pressable, StyleSheet } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { router } from 'expo-router';
import { useChatStore } from '@/state/useChatStore';
import { useModelStore } from '@/state/useModelStore';
import { MODELS } from '@/models/registry';
import { ConversationRow } from './ConversationRow';
import { Logo } from '@/components/ds/Logo';
import { colors, radius, spacing, fonts } from '@/theme';

export function SidebarContent(props: DrawerContentComponentProps) {
  const { index, current, newChat, remove } = useChatStore();
  const { installed, activeModelId, setActive } = useModelStore();

  const close = () => props.navigation.closeDrawer();

  const onNew = async () => {
    close();
    if (!activeModelId) { router.push('/(main)/settings'); return; }
    const id = await newChat(activeModelId);
    router.push(`/(main)/chat/${id}`);
  };

  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: colors.bgCard }} contentContainerStyle={{ paddingTop: 0 }}>
      {/* header */}
      <View style={styles.header}>
        <Logo size={26} withWordmark />
      </View>

      {/* model selector */}
      <View style={styles.section}>
        <Text style={styles.label}>Model</Text>
        {MODELS.map((m) => {
          const ready = !!installed[m.id];
          const active = activeModelId === m.id;
          return (
            <Pressable
              key={m.id}
              disabled={!ready}
              onPress={() => setActive(m.id)}
              style={[styles.modelRow, { borderColor: active ? m.color : colors.border }, !ready && styles.disabled]}
            >
              <View style={[styles.dot, { backgroundColor: m.color, opacity: active ? 1 : 0.4 }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.modelName, { color: active ? m.color : colors.text }]} numberOfLines={1}>{m.name}</Text>
                <Text style={styles.modelMeta}>{m.sizeLabel} · {ready ? (active ? 'Active' : 'Tap to use') : 'Not installed'}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* new chat */}
      <View style={styles.sectionTight}>
        <Pressable style={styles.newBtn} onPress={onNew}>
          <Text style={styles.plus}>+</Text>
          <Text style={styles.newLabel}>New chat</Text>
        </Pressable>
      </View>

      {/* conversations */}
      <View style={styles.section}>
        <Text style={styles.label}>Conversations</Text>
        {index.length === 0 && <Text style={styles.empty}>No conversations yet.</Text>}
        {index.map((meta) => (
          <ConversationRow
            key={meta.id}
            meta={meta}
            active={current?.id === meta.id}
            onPress={() => { close(); router.push(`/(main)/chat/${meta.id}`); }}
            onLongPress={() => remove(meta.id)}
          />
        ))}
      </View>

      {/* settings footer */}
      <Pressable style={styles.settingsBtn} onPress={() => { close(); router.push('/(main)/settings'); }}>
        <Text style={styles.settingsLabel}>⚙  Settings & Storage</Text>
      </Pressable>
    </DrawerContentScrollView>
  );
}
const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14 },
  section: { paddingHorizontal: 16, paddingBottom: 12 },
  sectionTight: { paddingHorizontal: 16, paddingBottom: 8 },
  label: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, fontFamily: fonts.sans },
  modelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.bgCard, borderWidth: 1, borderRadius: radius.md, marginBottom: 8 },
  disabled: { opacity: 0.45 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  modelName: { fontSize: 14, fontFamily: fonts.sansBold },
  modelMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontFamily: fonts.sans },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  plus: { fontSize: 18, color: colors.violet, fontFamily: fonts.sansHeavy },
  newLabel: { color: colors.text, fontSize: 14, fontFamily: fonts.sansSemibold },
  empty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic', paddingVertical: 8 },
  settingsBtn: { borderTopWidth: 1, borderTopColor: colors.border, padding: 16, marginTop: spacing.sm },
  settingsLabel: { color: colors.text, fontSize: 14, fontFamily: fonts.sans },
});
