import { useCallback, useMemo, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { FileText } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Message, FileAttachment } from '@/types';
import { MarkdownView } from '@/components/common/Markdown';
import { stripSpecialTokens } from '@/llm/prompt';
import { extractQuestion, finalizeAssistantText, segmentMessage, AetherQuestion } from '@/llm/messageParse';
import { useChatStore } from '@/state/useChatStore';
import { useAgentStore } from '@/state/useAgentStore';
import { AgentLiveCard, AgentReceiptCard } from './AgentTaskCard';
import { ResearchLiveCard, ResearchSources } from './ResearchCard';
import { useResearchStore } from '@/state/useResearchStore';
import { formatResearchMarkdown } from '@/webresearch/format';
import { QuestionCard } from './QuestionCard';
import { CopyBlock } from './CopyBlock';
import { TypingIndicator } from './TypingIndicator';
import { ImageViewer } from './ImageViewer';
import { formatBytes } from '@/files/FileProcessor';
import { useToast } from '@/state/useToast';
import { radius, spacing, fonts, Palette, fontSize, typography } from '@/theme';
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
                {DOC_LABEL[a.type]} / {formatBytes(a.sizeBytes)}
                {a.pageCount ? ` / ${a.pageCount}p` : ''}
              </Text>
            </View>
          </View>
        ),
      )}
      <ImageViewer uri={viewer} visible={!!viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

/**
 * Quiet, honest Core disclosure: one muted line naming the notes provided as
 * context for this reply; tap to see why each was selected. Renders only when
 * topical recall actually fired, so trivial replies stay clean.
 */
function RecallFooter({ items }: { items: NonNullable<Message['coreRecall']> }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.recall}>
      <Pressable onPress={() => setOpen((v) => !v)} hitSlop={8}>
        <Text style={styles.recallLine}>
          From your Core: {items.map((i) => i.key.replace(/_/g, ' ')).join(', ')}
        </Text>
      </Pressable>
      {open && items.map((i) => (
        <Text key={i.key} style={styles.recallWhy}>
          {i.key.replace(/_/g, ' ')} — {i.why}
        </Text>
      ))}
    </View>
  );
}

/** Copy a message's text to the clipboard with haptic + toast confirmation. */
function useCopy(content: string) {
  const show = useToast((s) => s.show);
  return useCallback(async () => {
    if (!content) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
    await Clipboard.setStringAsync(content);
    show('Copied');
  }, [content, show]);
}

/** What the assistant row should show, derived once per content change. */
function deriveView(message: Message, stripped: string, pending: boolean): {
  prose: string;
  question: AetherQuestion | null;
  /** Mid-stream question JSON: hold the indicator, never flash raw JSON. */
  holding: boolean;
} {
  if (message.question) return { prose: stripped, question: message.question, holding: false };
  if (pending) {
    const ex = extractQuestion(stripped);
    if (ex) return { prose: ex.prose, question: ex.question, holding: false };
    const markerIdx = stripped.indexOf('__aether_question');
    if (markerIdx !== -1) {
      // Question JSON mid-stream after some prose: keep the prose the user has
      // already seen visible; only the JSON part hides behind the indicator.
      const jsonStart = stripped.lastIndexOf('{', markerIdx);
      return { prose: jsonStart > 0 ? stripped.slice(0, jsonStart).trim() : '', question: null, holding: true };
    }
    return { prose: stripped, question: null, holding: false };
  }
  // Finished message (also heals legacy persisted raw-JSON content at render).
  const fin = finalizeAssistantText(stripped);
  return { prose: fin.content, question: fin.question ?? null, holding: false };
}

export function MessageBubble({ message, isLast = false, onOptionSelect }: {
  message: Message;
  isLast?: boolean;
  onOptionSelect?: (option: string, messageId: string) => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const isUser = message.role === 'user';
  const stripped = stripSpecialTokens(message.content);
  // Copying a research answer must carry its sources; on screen they are cards,
  // so the numbered list only exists on the clipboard.
  const copy = useCopy(
    message.research
      ? formatResearchMarkdown({ answer: stripped, sources: message.research.sources })
      : stripped,
  );

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
  // The indicator is driven by generation STATE, never by content shape: a
  // finished message can never get stuck "typing" (the old failure mode when a
  // stream died mid-question-JSON).
  const pending = isLast && isGenerating;
  const view = deriveView(message, stripped, pending);
  const empty = !view.prose && !view.question;

  // A live Actions task owns this (last, in-progress) message: its card shows
  // progress, approvals, and questions in place of the typing indicator.
  const liveTask = useAgentStore((s) => s.liveTask);
  const convoId = useChatStore((s) => s.current?.id ?? '');
  const researchConvo = useResearchStore((s) => s.conversationId);

  // Research in flight owns this message: the card shows which pages are being
  // opened. Once the answer starts streaming it takes over the body, and the
  // card stays above it so the sources remain visible while it writes.
  const liveResearch = pending && !!researchConvo && researchConvo === convoId;

  if (pending && liveTask && liveTask.conversationId === convoId) {
    return (
      <View style={styles.assistantRow}>
        <Text style={styles.name}>Aether</Text>
        <AgentLiveCard />
      </View>
    );
  }

  // Assistant: no bubble, no avatar, bare text on black with the name above.
  return (
    <View style={styles.assistantRow}>
      <Text style={styles.name}>Aether</Text>
      {liveResearch ? (
        <View>
          <ResearchLiveCard />
          {!!view.prose && (
            <View style={styles.researchProse}>
              <MarkdownView content={view.prose} />
            </View>
          )}
        </View>
      ) : pending && !view.prose && (empty || view.holding) ? (
        <TypingIndicator />
      ) : empty && !view.holding ? (
        <View>
          <Text style={styles.stopped}>{message.stopped ? '(stopped)' : '(no reply — try again)'}</Text>
          {message.agentReceipt && message.agentTaskId && (
            <AgentReceiptCard receipt={message.agentReceipt} taskId={message.agentTaskId} />
          )}
        </View>
      ) : (
        // Prose is wrapped in its own long-press-to-copy Pressable; copy blocks
        // render as bare siblings, never nested under a Pressable, so their own
        // copy button receives the tap. A parent Pressable's long-press
        // responder swallows a child Pressable's onPress under the New
        // Architecture, which is why the block copy button did nothing before.
        <View>
          {!!view.prose && segmentMessage(view.prose, { streaming: pending }).map((seg, i) =>
            seg.type === 'text' ? (
              <Pressable key={i} onLongPress={copy} delayLongPress={300}>
                <MarkdownView content={seg.content} />
              </Pressable>
            ) : (
              <CopyBlock
                key={i}
                content={seg.content}
                mono={seg.type === 'code'}
                lang={seg.type === 'code' ? seg.lang : undefined}
                pending={seg.pending}
              />
            ),
          )}
          {pending && view.holding && <TypingIndicator />}
          {view.question && (
            <QuestionCard
              question={view.question}
              answered={!!message.questionAnswer || !isLast}
              picked={message.questionAnswer ?? null}
              onSelect={onOptionSelect ? (option) => onOptionSelect(option, message.id) : undefined}
            />
          )}
          {message.stopped && <Text style={styles.stopped}>(stopped)</Text>}
          {message.research && <ResearchSources research={message.research} />}
          {message.agentReceipt && message.agentTaskId && (
            <AgentReceiptCard receipt={message.agentReceipt} taskId={message.agentTaskId} />
          )}
          {!!message.coreRecall?.length && <RecallFooter items={message.coreRecall} />}
        </View>
      )}
    </View>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  researchProse: { marginTop: spacing.md },
  row: { marginBottom: spacing.xl, flexDirection: 'row' },
  right: { justifyContent: 'flex-end' },
  // flex:1 gives the column a definite width so the bubble's `maxWidth` resolves.
  userCol: { flex: 1, alignItems: 'flex-end', gap: spacing.sm },
  attachments: { gap: spacing.sm, alignItems: 'flex-end' },
  attachImage: { width: 220, height: 220, borderRadius: radius.lg, backgroundColor: c.bgInput },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.bgInput, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 11, maxWidth: 240 },
  fileCardIcon: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  fileCardName: { color: c.text, ...typography.label },
  fileCardMeta: { color: c.textMuted, marginTop: 1, ...typography.metadata },
  // Assistant turn: bare on the background, name label above, roomy gap below.
  assistantRow: { marginBottom: spacing.xxl },
  name: { color: c.textMuted, marginBottom: 6, ...typography.chip },
  // User turn: quiet, right-aligned surface. Violet stays for controls/thinking.
  bubble: { borderRadius: radius.md, paddingHorizontal: 15, paddingVertical: 10 },
  user: {
    maxWidth: '82%',
    backgroundColor: c.bgInput,
    borderWidth: 1,
    borderColor: c.border,
    borderBottomRightRadius: radius.sm,
  },
  userText: { color: c.text, ...typography.input },
  stopped: { marginTop: spacing.xs, color: c.textMuted, ...typography.caption },
  recall: { marginTop: spacing.sm },
  recallLine: { color: c.textMuted, ...typography.receipt },
  recallWhy: { color: c.textMuted, marginTop: spacing.xs, opacity: 0.8, ...typography.receipt },
});
