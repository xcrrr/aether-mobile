import { View, Text, Pressable, StyleSheet } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { router } from 'expo-router';
import { useChatStore } from '@/state/useChatStore';
import { useModelStore } from '@/state/useModelStore';
import { ConversationRow } from './ConversationRow';
import { ModelSelector } from './ModelSelector';
import { colors, radius, spacing } from '@/theme';

export function SidebarContent(props: DrawerContentComponentProps) {
  const { index, newChat, remove } = useChatStore();
  const activeModelId = useModelStore((s) => s.activeModelId);

  const onNew = async () => {
    props.navigation.closeDrawer();
    if (!activeModelId) { router.push('/(main)/settings'); return; }
    const id = await newChat(activeModelId);
    router.push(`/(main)/chat/${id}`);
  };

  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: colors.bgCard }}>
      <View style={styles.pad}>
        <Pressable style={styles.newBtn} onPress={onNew}>
          <Text style={styles.newLabel}>+ New chat</Text>
        </Pressable>

        <Text style={styles.section}>Conversations</Text>
        {index.length === 0 && <Text style={styles.empty}>No conversations yet</Text>}
        {index.map((meta) => (
          <ConversationRow
            key={meta.id}
            meta={meta}
            onPress={() => { props.navigation.closeDrawer(); router.push(`/(main)/chat/${meta.id}`); }}
            onLongPress={() => remove(meta.id)}
          />
        ))}

        <ModelSelector />

        <Pressable
          style={styles.settingsBtn}
          onPress={() => { props.navigation.closeDrawer(); router.push('/(main)/settings'); }}
        >
          <Text style={styles.settingsLabel}>⚙  Settings & Storage</Text>
        </Pressable>
      </View>
    </DrawerContentScrollView>
  );
}
const styles = StyleSheet.create({
  pad: { padding: spacing.md },
  newBtn: { backgroundColor: colors.purple, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.lg },
  newLabel: { color: '#fff', fontWeight: '700' },
  section: { color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', marginBottom: spacing.sm },
  empty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic', marginBottom: spacing.md },
  settingsBtn: { marginTop: spacing.xl, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  settingsLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
