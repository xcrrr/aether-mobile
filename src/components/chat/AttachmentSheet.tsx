import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Camera, Image as ImageIcon, FileText, ClipboardPaste, X } from 'lucide-react-native';
import { clipboardHasImage } from '@/files/picker';
import { colors, radius, spacing, fonts } from '@/theme';

interface Row {
  key: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  onPress: () => void;
}

export function AttachmentSheet({ visible, onClose, onCamera, onLibrary, onFiles, onPaste }: {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onLibrary: () => void;
  onFiles: () => void;
  onPaste: () => void;
}) {
  const [hasImage, setHasImage] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void clipboardHasImage().then((v) => { if (alive) setHasImage(v); });
    return () => { alive = false; };
  }, [visible]);

  const pick = (fn: () => void) => () => { onClose(); fn(); };

  const rows: Row[] = [
    { key: 'camera', icon: <Camera size={20} color={colors.violet} />, label: 'Camera', sub: 'Take a photo to ask about', onPress: pick(onCamera) },
    { key: 'library', icon: <ImageIcon size={20} color={colors.violet} />, label: 'Photo Library', sub: 'Choose an existing image', onPress: pick(onLibrary) },
    { key: 'files', icon: <FileText size={20} color={colors.violet} />, label: 'Files', sub: 'PDF, Word, text, and more', onPress: pick(onFiles) },
  ];
  if (hasImage) {
    rows.push({ key: 'paste', icon: <ClipboardPaste size={20} color={colors.violet} />, label: 'Paste image', sub: 'Use the image on your clipboard', onPress: pick(onPaste) });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Attach</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          {rows.map((r) => (
            <Pressable key={r.key} style={styles.row} onPress={r.onPress}>
              <View style={styles.iconWrap}>{r.icon}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{r.label}</Text>
                <Text style={styles.rowSub}>{r.sub}</Text>
              </View>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgCard, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl,
    borderTopWidth: 1, borderColor: colors.border,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  iconWrap: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.assistantBubble, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.text },
  rowSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 1 },
});
