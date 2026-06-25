import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Settings, Plus, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { useChatStore } from '@/state/useChatStore';
import { useModelStore } from '@/state/useModelStore';
import { ConversationRow } from './ConversationRow';
import { fonts, Palette } from '@/theme';
import { useColors } from '@/theme/useColors';

const BTN_H = 46;
const FADE_H = 88;

export function SidebarContent(props: DrawerContentComponentProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { index, current, newChat, remove } = useChatStore();
  const { activeModelId } = useModelStore();

  const close = () => props.navigation.closeDrawer();
  const footerH = BTN_H + 22 + insets.bottom;

  const onNew = async () => {
    close();
    if (!activeModelId) { router.push('/(main)/settings'); return; }
    const id = await newChat(activeModelId);
    router.push(`/(main)/chat/${id}`);
  };

  return (
    <View style={styles.root}>
      <DrawerContentScrollView
        {...props}
        style={{ backgroundColor: c.bgSidebar }}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: footerH + FADE_H }}
      >
        {/* header — wordmark only, clearing the notification area */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.wordmark}>Aether</Text>
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
              onLongPress={() => remove(meta.id)}
            />
          ))}
        </View>
      </DrawerContentScrollView>

      {/* fade — recents dissolve into the sidebar grey above the bar */}
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

      {/* bottom bar — settings (subtle) + new chat (prominent) */}
      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={styles.settingsBtn} onPress={() => { close(); router.push('/(main)/settings'); }}>
          <Settings size={18} color={c.textMuted} strokeWidth={1.8} />
          <Text style={styles.settingsLabel}>Settings</Text>
        </Pressable>
        <Pressable style={styles.newBtn} onPress={onNew}>
          <Plus size={19} color={c.white} strokeWidth={2.4} />
          <Text style={styles.newLabel}>New chat</Text>
        </Pressable>
      </View>
    </View>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bgSidebar },
  header: { paddingHorizontal: 18, paddingBottom: 18 },
  wordmark: { fontFamily: fonts.sansHeavy, fontSize: 24, letterSpacing: -0.5, color: c.text },
  section: { paddingHorizontal: 18, paddingBottom: 16 },
  sectionTight: { paddingHorizontal: 18, paddingBottom: 8 },
  label: { color: c.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontFamily: fonts.sansSemibold },
  brainBtn: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  brainLabel: { color: c.text, fontSize: 15, fontFamily: fonts.display },
  brainMeta: { color: c.textMuted, fontSize: 11, marginTop: 1, fontFamily: fonts.sans },
  empty: { color: c.textMuted, fontSize: 13, fontStyle: 'italic', paddingVertical: 8, fontFamily: fonts.sans },

  fade: { position: 'absolute', left: 0, right: 0, height: FADE_H },

  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 10, backgroundColor: c.bgSidebar },
  settingsBtn: { height: BTN_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: c.border },
  settingsLabel: { color: c.textMuted, fontSize: 14, fontFamily: fonts.sansSemibold },
  newBtn: { flex: 1, height: BTN_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: c.violet },
  newLabel: { color: c.white, fontSize: 15, fontFamily: fonts.display },
});
