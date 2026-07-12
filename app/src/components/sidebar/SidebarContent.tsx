import { useMemo } from 'react';
import { Alert, View, Text, StyleSheet } from 'react-native';
import { PressableScale } from '@/components/ds/PressableScale';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Settings, Plus, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { useChatStore } from '@/state/useChatStore';
import { useModelStore } from '@/state/useModelStore';
import { useLibraryStore } from '@/state/useLibraryStore';
import { ConversationRow } from './ConversationRow';
import { radius, spacing, fonts, Palette, fontSize, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

const BTN_H = 46;
const FADE_H = 88;

export function SidebarContent(props: DrawerContentComponentProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { index, current, newChat, remove } = useChatStore();
  const { activeModelId } = useModelStore();
  const libraryCount = useLibraryStore((s) => s.items.length);

  const close = () => props.navigation.closeDrawer();
  const footerH = BTN_H + 22 + insets.bottom;

  const onNew = async () => {
    close();
    if (!activeModelId) { router.push('/(main)/settings'); return; }
    const id = await newChat(activeModelId);
    router.push(`/(main)/chat/${id}`);
  };

  const removeChat = async (id: string) => {
    const wasActive = current?.id === id;
    await remove(id);
    if (!wasActive) return;
    const nextId = useChatStore.getState().index[0]?.id;
    close();
    router.replace(nextId ? `/(main)/chat/${nextId}` : '/(main)');
  };

  const confirmRemove = (id: string, title: string) => {
    Alert.alert(
      'Delete chat?',
      `"${title || 'New chat'}" will be removed from this device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { void removeChat(id); } },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <DrawerContentScrollView
        {...props}
        style={{ backgroundColor: c.bgSidebar }}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: footerH + FADE_H }}
      >
        {/* Header wordmark only, clearing the notification area. */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.wordmark}>Aether</Text>
        </View>

        {/* Core */}
        <View style={styles.sectionTight}>
          <PressableScale style={styles.brainBtn} onPress={() => { close(); router.push('/(main)/second-brain'); }} scaleTo={0.98}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.brainLabel}>Core</Text>
              <Text style={styles.brainMeta}>Memory / thought graph</Text>
            </View>
            <ChevronRight size={18} color={c.textMuted} strokeWidth={2} />
          </PressableScale>
        </View>

        {/* Library */}
        <View style={styles.sectionTight}>
          <PressableScale style={styles.brainBtn} onPress={() => { close(); router.push('/(main)/library'); }} scaleTo={0.98}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.brainLabel}>Library</Text>
              <Text style={styles.brainMeta}>Kept Task outputs</Text>
            </View>
            {libraryCount > 0 && <Text style={styles.countPill}>{libraryCount}</Text>}
            <ChevronRight size={18} color={c.textMuted} strokeWidth={2} />
          </PressableScale>
        </View>

        {/* chats */}
        <View style={styles.section}>
          <Text style={styles.label}>Recents</Text>
          {index.length === 0 && <Text style={styles.empty}>No conversations yet.</Text>}
          {index.map((meta) => (
            <ConversationRow
              key={meta.id}
              meta={meta}
              active={current?.id === meta.id}
              onPress={() => { close(); router.push(`/(main)/chat/${meta.id}`); }}
              onLongPress={() => confirmRemove(meta.id, meta.title)}
            />
          ))}
        </View>
      </DrawerContentScrollView>

      {/* Recents dissolve into the sidebar grey above the bar. */}
      <View pointerEvents="none" style={[styles.fade, { bottom: footerH }]}>
        <Svg width="100%" height={FADE_H}>
          <Defs>
            <LinearGradient id="sbFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.bgSidebar} stopOpacity="0" />
              <Stop offset="0.65" stopColor={c.bgSidebar} stopOpacity="0.92" />
              <Stop offset="1" stopColor={c.bgSidebar} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#sbFade)" />
        </Svg>
      </View>

      {/* Bottom bar: settings subtle, new chat prominent. */}
      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <PressableScale style={styles.settingsBtn} onPress={() => { close(); router.push('/(main)/settings'); }}>
          <Settings size={18} color={c.textMuted} strokeWidth={1.8} />
          <Text style={styles.settingsLabel}>Settings</Text>
        </PressableScale>
        <PressableScale style={styles.newBtn} onPress={onNew} haptic>
          <Plus size={19} color={c.text} strokeWidth={2.2} />
          <Text style={styles.newLabel}>New chat</Text>
        </PressableScale>
      </View>
    </View>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bgSidebar },
  header: { paddingHorizontal: 18, paddingBottom: 18 },
  wordmark: { fontFamily: fonts.displayBold, fontSize: fontSize.xxl, color: c.text },
  section: { paddingHorizontal: 18, paddingBottom: spacing.lg },
  sectionTight: { paddingHorizontal: 18, paddingBottom: spacing.sm },
  label: { color: c.textMuted, fontSize: fontSize.xs, textTransform: 'uppercase', letterSpacing: 0, marginBottom: 10, fontFamily: fonts.sansSemibold },
  brainBtn: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  brainLabel: { color: c.text, ...typography.sectionTitle },
  brainMeta: { color: c.textMuted, fontSize: fontSize.xs, marginTop: 1, fontFamily: fonts.sans },
  countPill: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.sansSemibold, marginRight: 6 },
  empty: { color: c.textMuted, fontSize: fontSize.sm2, paddingVertical: spacing.sm, fontFamily: fonts.sans },

  fade: { position: 'absolute', left: 0, right: 0, height: FADE_H },

  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 10, backgroundColor: c.bgSidebar },
  settingsBtn: { height: BTN_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 14, borderWidth: 1, borderColor: c.border },
  settingsLabel: { color: c.textMuted, fontSize: fontSize.base, fontFamily: fonts.sansSemibold },
  newBtn: {
    flex: 1,
    height: BTN_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.border,
  },
  newLabel: { color: c.text, ...typography.sectionTitle },
});
