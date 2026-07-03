import { useMemo } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Check, MessageCircle, Globe, Sparkles, X } from 'lucide-react-native';
import { radius, spacing, fonts, Palette, fontSize, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

export type ChatMode = 'chat' | 'research' | 'task';

interface Row {
  key: ChatMode;
  icon: React.ReactNode;
  title: string;
  beta?: boolean;
  desc: string;
}

/**
 * The single entry point for switching Chat / Research / Task. Replaces what
 * used to be three separate equal-weight pills — these are different kinds of
 * things (an intent, not a peer set of actions), so they get one quiet picker.
 */
export function ModeMenu({ visible, onClose, active, taskAvailable, onSelect }: {
  visible: boolean;
  onClose: () => void;
  active: ChatMode;
  taskAvailable: boolean;
  onSelect: (mode: ChatMode) => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const rows: Row[] = [
    { key: 'chat', icon: <MessageCircle size={16} color={active === 'chat' ? c.violet : c.textMuted} strokeWidth={1.8} />, title: 'Chat', desc: 'Direct conversation on your device.' },
    { key: 'research', icon: <Globe size={16} color={active === 'research' ? c.violet : c.textMuted} strokeWidth={1.8} />, title: 'Research', desc: 'Use the web when current information matters.' },
  ];
  if (taskAvailable) {
    rows.push({ key: 'task', icon: <Sparkles size={16} color={active === 'task' ? c.violet : c.textMuted} strokeWidth={1.8} />, title: 'Task', beta: true, desc: 'Handle a larger request and return something useful.' });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Mode</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={18} color={c.textMuted} />
            </Pressable>
          </View>
          {rows.map((r, i) => {
            const selected = r.key === active;
            return (
              <Pressable
                key={r.key}
                style={[styles.row, i > 0 && styles.rowDivider]}
                onPress={() => onSelect(r.key)}
              >
                <View style={styles.iconCol}>{r.icon}</View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.rowTitle, selected && { color: c.violet }]}>{r.title}</Text>
                    {r.beta && (
                      <View style={styles.betaTag}>
                        <Text style={styles.betaTagText}>Beta</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.rowDesc}>{r.desc}</Text>
                </View>
                {selected && <Check size={16} color={c.violet} strokeWidth={2} />}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.bgCard, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl,
    borderTopWidth: 1, borderColor: c.border,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  title: { color: c.textMuted, ...typography.label },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator },
  iconCol: { width: 16, alignItems: 'center', marginTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { fontFamily: fonts.sansMedium, fontSize: fontSize.body, color: c.text },
  rowDesc: { fontFamily: fonts.sans, fontSize: fontSize.sm2, color: c.textMuted, marginTop: 2, lineHeight: 18 },
  betaTag: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: radius.sm, backgroundColor: c.violetDim },
  betaTagText: { fontFamily: fonts.sansMedium, fontSize: fontSize.micro, color: c.violet, textTransform: 'uppercase', letterSpacing: 0.4 },
});
