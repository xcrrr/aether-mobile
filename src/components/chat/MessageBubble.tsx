import { useCallback, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { FileText } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Message, FileAttachment } from '@/types';
import { MarkdownView } from '@/components/common/Markdown';
import { stripSpecialTokens } from '@/llm/prompt';
import { TypingIndicator } from './TypingIndicator';
import { ImageViewer } from './ImageViewer';
import { formatBytes } from '@/files/FileProcessor';
import { useToast } from '@/state/useToast';
import { LOGO_PURPLE } from '@/components/ds/Logo';
import { colors, radius, spacing, fonts } from '@/theme';

const DOC_LABEL: Record<FileAttachment['type'], string> = {
  image: 'Image', pdf: 'PDF', text: 'Text', docx: 'Word',
};

/** Attachment previews rendered above a user message's text. */
function MessageAttachments({ attachments }: { attachments: FileAttachment[] }) {
  const [viewer, setViewer] = useState<string | null>(null);
  return (
    <View style={styles.attachments}>
      {attachments.map((a) =>
        a.type === 'image' ? (
          <Pressable key={a.id} onPress={() => setViewer(a.uri)}>
            <Image source={{ uri: a.uri }} style={styles.attachImage} resizeMode="cover" />
          </Pressable>
        ) : (
          <View key={a.id} style={styles.fileCard}>
            <View style={styles.fileCardIcon}>
              <FileText size={18} color={colors.violet} />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.fileCardName} numberOfLines={1}>{a.name}</Text>
              <Text style={styles.fileCardMeta}>
                {DOC_LABEL[a.type]} · {formatBytes(a.sizeBytes)}
                {a.pageCount ? ` · ${a.pageCount}p` : ''}
              </Text>
            </View>
          </View>
        ),
      )}
      <ImageViewer uri={viewer} visible={!!viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

function Avatar() {
  return (
    <View style={styles.avatar}>
      <Image source={LOGO_PURPLE} style={{ width: 17, height: 17 }} resizeMode="contain" />
    </View>
  );
}

/** Copy a message's text to the clipboard with haptic + toast confirmation. */
function useCopy(content: string) {
  const show = useToast((s) => s.show);
  return useCallback(async () => {
    if (!content) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(content);
    show('Copied');
  }, [content, show]);
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const copy = useCopy(message.content);

  const hasAttachments = !!message.attachments?.length;

  if (isUser) {
    return (
      <View style={[styles.row, styles.right]}>
        <View style={styles.userCol}>
          {hasAttachments && <MessageAttachments attachments={message.attachments!} />}
          {!!message.content && (
            <Pressable onLongPress={copy} delayLongPress={300} style={[styles.bubble, styles.user]}>
              <Text style={styles.userText}>{message.content}</Text>
              {message.stopped && <Text style={styles.stopped}>(stopped)</Text>}
            </Pressable>
          )}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.assistantRow}>
      <Avatar />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name}>Aether</Text>
        {message.content
          ? (
            <Pressable onLongPress={copy} delayLongPress={300} style={[styles.bubble, styles.assistant]}>
              <MarkdownView content={stripSpecialTokens(message.content)} />
              {message.stopped && <Text style={styles.stopped}>(stopped)</Text>}
            </Pressable>
          )
          : <TypingIndicator />}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { marginBottom: spacing.lg, flexDirection: 'row' },
  right: { justifyContent: 'flex-end' },
  // flex:1 gives the column a definite width so the bubble's `maxWidth:'85%'`
  // resolves. Without it, nested percentage widths collapsed to min-content and
  // short text wrapped one character per line ("hi" -> "h"/"i").
  userCol: { flex: 1, alignItems: 'flex-end', gap: spacing.sm },
  attachments: { gap: spacing.sm, alignItems: 'flex-end' },
  // Fixed width: a percentage width has no definite parent to resolve against
  // here (parents are content-sized with only maxWidth), so it collapsed to ~0
  // and the image never showed.
  attachImage: { width: 220, height: 220, borderRadius: radius.md, backgroundColor: colors.assistantBubble },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 10, maxWidth: 240 },
  fileCardIcon: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.assistantBubble, alignItems: 'center', justifyContent: 'center' },
  fileCardName: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text },
  fileCardMeta: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  assistantRow: { marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  bubble: { borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  user: { maxWidth: '85%', backgroundColor: colors.userBubble },
  assistant: { alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: colors.assistantBubble },
  userText: { color: colors.white, fontSize: 15, lineHeight: 22, fontFamily: fonts.sans },
  stopped: { marginTop: 4, color: colors.textMuted, fontSize: 12, fontStyle: 'italic', fontFamily: fonts.sans },
});
