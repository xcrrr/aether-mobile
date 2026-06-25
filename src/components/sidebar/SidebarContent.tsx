import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { useChatStore } from '@/state/useChatStore';
import { useModelStore } from '@/state/useModelStore';
import { MODELS } from '@/models/registry';
import { ConversationRow } from './ConversationRow';
import { Logo } from '@/components/ds/Logo';
import { spacing, fonts, Palette } from '@/theme';
import { useColors } from '@/theme/useColors';

export function SidebarContent(props: DrawerContentComponentProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
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
    <DrawerContentScrollView {...props} style={{ backgroundColor: c.bgSidebar }} contentContainerStyle={{ paddingTop: 0 }}>
      {/* header — clear the status bar / notification area without sitting too low */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
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
              style={[styles.modelRow, { borderColor: active ? m.color : c.border }, !ready && styles.disabled]}
            >
              <View style={[styles.dot, { backgroundColor: m.color, opacity: active ? 1 : 0.4 }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.modelName, { color: active ? m.color : c.text }]} numberOfLines={1}>{m.name}</Text>
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

      {/* core */}
      <View style={styles.sectionTight}>
        <Pressable style={styles.brainBtn} onPress={() => { close(); router.push('/(main)/second-brain'); }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.brainLabel}>Core</Text>
            <Text style={styles.brainMeta}>Memory · thought graph</Text>
          </View>
          <ChevronRight size={18} color={c.textMuted} strokeWidth={2} />
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
        <Settings size={17} color={c.textMuted} strokeWidth={1.8} />
        <Text style={styles.settingsLabel}>Settings & Storage</Text>
      </Pressable>
    </DrawerContentScrollView>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  header: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 18 },
  section: { paddingHorizontal: 18, paddingBottom: 16 },
  sectionTight: { paddingHorizontal: 18, paddingBottom: 4 },
  label: { color: c.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontFamily: fonts.sansSemibold },
  // Flat rows — no card, no border. Just a colour dot + serif name.
  modelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  disabled: { opacity: 0.4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  modelName: { fontSize: 15, fontFamily: fonts.sansSemibold },
  modelMeta: { fontSize: 12, color: c.textMuted, marginTop: 2, fontFamily: fonts.sans },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  plus: { fontSize: 20, color: c.violet, fontFamily: fonts.sans, lineHeight: 22 },
  newLabel: { color: c.text, fontSize: 15, fontFamily: fonts.display },
  brainBtn: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  brainLabel: { color: c.text, fontSize: 15, fontFamily: fonts.display },
  brainMeta: { color: c.textMuted, fontSize: 11, marginTop: 1, fontFamily: fonts.sans },
  empty: { color: c.textMuted, fontSize: 13, fontStyle: 'italic', paddingVertical: 8, fontFamily: fonts.sans },
  settingsBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: c.separator, paddingHorizontal: 18, paddingVertical: 16, marginTop: spacing.sm },
  settingsLabel: { color: c.textMuted, fontSize: 14, fontFamily: fonts.sans },
});
