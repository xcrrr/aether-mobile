import { useCallback, useMemo, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { FileText } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Message, FileAttachment } from '@/types';
import { MarkdownView } from '@/components/common/Markdown';
import { stripSpecialTokens } from '@/llm/prompt';
import { parseQuestion, segmentMessage } from '@/llm/messageParse';
import { QuestionCard } from './QuestionCard';
import { CopyBlock } from './CopyBlock';
import { TypingIndicator } from './TypingIndicator';
import { ImageViewer } from './ImageViewer';
import { formatBytes } from '@/files/FileProcessor';
import { useToast } from '@/state/useToast';
import { radius, spacing, fonts, Palette } from '@/theme';
import { useColors } from '@/theme/useColors';

const DOC_LABEL: Record<FileAttachment['type'], string> = {
  image: 'Image', pdf: 'PDF', text: 'Text', docx: 'Word',
};

/** Attachment previews rendered above a user message's text. */
function MessageAttachments({ attachments }: { attachments: FileAttachment[] }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
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
              <FileText size={18} color={c.violet} />
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

export function MessageBubble({ message, isLast = false, onOptionSelect }: {
  message: Message;
  isLast?: boolean;
  onOptionSelect?: (option: string) => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isUser = message.role === 'user';
  const stripped = stripSpecialTokens(message.content);
  const copy = useCopy(stripped);

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
  const question = stripped ? parseQuestion(stripped) : null;
  // A clarifying-question JSON still mid-stream: hold the typing indicator
  // instead of flashing the half-typed raw JSON.
  const pendingQuestion = !question && stripped.includes('__aether_question');
  // Assistant: no bubble, no avatar — bare text on black, name above. Like Claude.
  return (
    <View style={styles.assistantRow}>
      <Text style={styles.name}>Aether</Text>
      {question ? (
        <QuestionCard question={question} answered={!isLast} onSelect={onOptionSelect} />
      ) : !stripped || pendingQuestion ? (
        <TypingIndicator />
      ) : (
        // Prose is wrapped in its own long-press-to-copy Pressable; copy blocks
        // render as bare siblings, never nested under a Pressable, so their own
        // copy button receives the tap. A parent Pressable's long-press
        // responder swallows a child Pressable's onPress under the New
        // Architecture — that is why the block copy button did nothing before.
        <View>
          {segmentMessage(stripped).map((seg, i) =>
            seg.type === 'text' ? (
              <Pressable key={i} onLongPress={copy} delayLongPress={300}>
                <MarkdownView content={seg.content} />
              </Pressable>
            ) : (
              <CopyBlock key={i} content={seg.content} mono={seg.type === 'code'} lang={seg.type === 'code' ? seg.lang : undefined} />
            ),
          )}
          {message.stopped && <Text style={styles.stopped}>(stopped)</Text>}
        </View>
      )}
    </View>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  row: { marginBottom: spacing.xl, flexDirection: 'row' },
  right: { justifyContent: 'flex-end' },
  // flex:1 gives the column a definite width so the bubble's `maxWidth` resolves.
  userCol: { flex: 1, alignItems: 'flex-end', gap: spacing.sm },
  attachments: { gap: spacing.sm, alignItems: 'flex-end' },
  attachImage: { width: 220, height: 220, borderRadius: radius.lg, backgroundColor: c.bgInput },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.bgInput, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 11, maxWidth: 240 },
  fileCardIcon: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  fileCardName: { fontFamily: fonts.sansMedium, fontSize: 13, color: c.text },
  fileCardMeta: { fontFamily: fonts.sans, fontSize: 11, color: c.textMuted, marginTop: 1 },
  // Assistant turn: bare on the background, name label above, roomy gap below.
  assistantRow: { marginBottom: spacing.xxl },
  name: { fontFamily: fonts.sansMedium, fontSize: 12, color: c.textMuted, marginBottom: 6, letterSpacing: 0.2 },
  // User turn: a single solid-purple bubble, right-aligned.
  bubble: { borderRadius: radius.lg, paddingHorizontal: 15, paddingVertical: 10 },
  user: { maxWidth: '82%', backgroundColor: c.violet, borderBottomRightRadius: radius.sm },
  userText: { color: c.white, fontSize: 15, lineHeight: 22, fontFamily: fonts.sans },
  stopped: { marginTop: 4, color: c.textMuted, fontSize: 12, fontStyle: 'italic', fontFamily: fonts.sans },
});
