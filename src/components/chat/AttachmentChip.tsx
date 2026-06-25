import { useMemo } from 'react';
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { FileText, AlertTriangle, X } from 'lucide-react-native';
import { FileAttachment } from '@/types';
import { formatBytes } from '@/files/FileProcessor';
import { radius, spacing, fonts, Palette } from '@/theme';
import { useColors } from '@/theme/useColors';

const truncateName = (name: string): string =>
  name.length > 20 ? `${name.slice(0, 17)}…` : name;

const LABEL: Record<FileAttachment['type'], string> = {
  image: 'Image',
  pdf: 'PDF',
  text: 'Text',
  docx: 'Word',
};

export function AttachmentChip({ attachment, processing, error, onRemove, onPressError }: {
  attachment: FileAttachment | null;
  processing: boolean;
  error: string | null;
  onRemove: () => void;
  onPressError: (message: string) => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  if (processing) {
    return (
      <View style={styles.chip}>
        <ActivityIndicator size="small" color={c.violet} />
        <Text style={styles.name}>Processing…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <Pressable style={[styles.chip, styles.errorChip]} onPress={() => onPressError(error)}>
        <AlertTriangle size={16} color={c.danger} />
        <Text style={[styles.name, { color: c.danger }]} numberOfLines={1}>
          Attachment failed
        </Text>
        <Pressable onPress={onRemove} hitSlop={8} style={styles.remove}>
          <X size={14} color={c.danger} />
        </Pressable>
      </Pressable>
    );
  }

  if (!attachment) return null;

  const hasWarning = !!attachment.processingError;
  const isLarge = (attachment.extractedText?.length ?? 0) > 6000;

  return (
    <View style={styles.column}>
      <View style={[styles.chip, hasWarning && styles.warnChip]}>
        {attachment.type === 'image' && attachment.imageBase64 ? (
          <Image
            source={{ uri: attachment.uri }}
            style={styles.thumb}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.fileIcon}>
            <FileText size={18} color={c.violet} />
          </View>
        )}
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{truncateName(attachment.name)}</Text>
          <Text style={styles.meta}>
            {LABEL[attachment.type]} · {formatBytes(attachment.sizeBytes)}
            {attachment.pageCount ? ` · ${attachment.pageCount}p` : ''}
          </Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={8} style={styles.remove}>
          <X size={15} color={c.textMuted} />
        </Pressable>
      </View>

      {hasWarning && (
        <Pressable onPress={() => onPressError(attachment.processingError!)} style={styles.badge}>
          <AlertTriangle size={12} color={c.warning} />
          <Text style={styles.badgeText} numberOfLines={2}>{attachment.processingError}</Text>
        </Pressable>
      )}
      {!hasWarning && isLarge && (
        <View style={styles.badge}>
          <AlertTriangle size={12} color={c.warning} />
          <Text style={styles.badgeText}>Large document — response quality may vary</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  column: { gap: spacing.xs, marginBottom: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    alignSelf: 'flex-start', maxWidth: '100%',
    backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border,
    borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: 8,
  },
  errorChip: { borderColor: c.danger, backgroundColor: c.dangerBg },
  warnChip: { borderColor: c.warning },
  thumb: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.assistantBubble },
  fileIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.assistantBubble, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.sansMedium, fontSize: 13, color: c.text },
  meta: { fontFamily: fonts.sans, fontSize: 11, color: c.textMuted, marginTop: 1 },
  remove: { padding: 2, marginLeft: spacing.xs },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 2 },
  badgeText: { fontFamily: fonts.sans, fontSize: 11, color: c.warning, flexShrink: 1 },
});
