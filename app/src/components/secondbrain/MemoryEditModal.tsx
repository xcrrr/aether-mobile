import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import { PressableScale } from '@/components/ds/PressableScale';
import { useMemoryStore } from '@/secondbrain/MemoryStore';
import { MemoryEntry } from '@/secondbrain/types';
import { fontSize, fonts, Palette, radius, spacing, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

interface Props {
  entry: MemoryEntry | null;
  onClose: () => void;
}

export function MemoryEditModal({ entry, onClose }: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const updateEntry = useMemoryStore((state) => state.updateEntry);
  const [value, setValue] = useState('');

  useEffect(() => {
    setValue(entry?.value ?? '');
  }, [entry]);

  const trimmedValue = value.trim();
  const canSave = !!entry && !!trimmedValue;

  const save = () => {
    if (!entry || !trimmedValue) return;
    updateEntry(entry.id, { value: trimmedValue });
    onClose();
  };

  return (
    <Modal visible={!!entry} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit memory</Text>
            <PressableScale accessibilityLabel="Close memory editor" onPress={onClose} hitSlop={8}>
              <X size={18} color={c.textMuted} strokeWidth={2} />
            </PressableScale>
          </View>
          <TextInput
            accessibilityLabel="Memory value"
            style={styles.input}
            value={value}
            onChangeText={setValue}
            multiline
            autoFocus
            placeholder="What should Aether remember?"
            placeholderTextColor={c.textMuted}
          />
          <View style={styles.actions}>
            <PressableScale style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </PressableScale>
            <PressableScale
              accessibilityLabel="Save memory"
              style={[styles.save, !canSave && styles.disabled]}
              onPress={save}
              disabled={!canSave}
              haptic
            >
              <Text style={styles.saveText}>Save</Text>
            </PressableScale>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: c.bgCard,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { color: c.text, ...typography.sectionTitle },
  input: {
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
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    justifyContent: 'flex-end',
  },
  cancel: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  cancelText: { color: c.textMuted, fontSize: fontSize.sm2, fontFamily: fonts.sansSemibold },
  save: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: c.violet,
  },
  disabled: { opacity: 0.4 },
  saveText: { color: c.white, ...typography.label },
});
