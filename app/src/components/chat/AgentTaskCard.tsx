import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { Check, X, CircleSlash, FileText, Globe, Brain, Paperclip, PenLine, Sparkles, MessageCircleQuestion, Download, ArrowUpRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { PressableScale } from '@/components/ds/PressableScale';
import { QuestionCard } from './QuestionCard';
import { ArtifactPreviewModal } from '@/components/library/ArtifactPreviewModal';
import { useAgentStore } from '@/state/useAgentStore';
import { useChatStore } from '@/state/useChatStore';
import { useLibraryStore } from '@/state/useLibraryStore';
import { useExportStore } from '@/state/useExportStore';
import { deriveTitle } from '@/library/artifact';
import { AgentArtifact, AgentReceipt, AgentStep } from '@/agent/types';
import { loadTask } from '@/agent/taskStorage';
import { useToast } from '@/state/useToast';
import { radius, spacing, Palette, typography, motion } from '@/theme';
import { useColors } from '@/theme/useColors';

/**
 * The Aether Actions surface inside a chat message.
 *
 * Live view: calm progress (current milestone + executed steps), the approval
 * prompt when a step needs consent, and the clarifying-question card. No
 * terminal theatrics, no microscopic event noise.
 *
 * Receipt view: an honest, expandable record of what actually ran — steps with
 * real outcomes, sources read, artifacts created — rendered from the persisted
 * ledger, never synthesized.
 */

const TOOL_ICON: Record<string, typeof Globe> = {
  web_research: Globe,
  read_core: Brain,
  read_attachments: Paperclip,
  create_artifact: FileText,
  revise_artifact: PenLine,
  ask_user: MessageCircleQuestion,
  finish: Check,
};

const TOOL_LABEL: Record<string, string> = {
  web_research: 'Web research',
  read_core: 'Core lookup',
  read_attachments: 'Read attachments',
  create_artifact: 'Create artifact',
  revise_artifact: 'Revise artifact',
  ask_user: 'Asked you',
  finish: 'Finish',
};

const RISK_EXPLAIN: Record<string, string> = {
  core_read: 'Reads your saved Core notes. Nothing leaves the device.',
  local_read_scoped: 'Reads only the files you attached to this chat.',
  web_read: 'Sends this search to the web and reads public pages.',
  artifact_draft: 'Writes a draft document inside this task only.',
};

/** Human phrasing for live milestones — outcomes, not tool names. */
const MILESTONE: Record<string, string> = {
  web_research: 'Looked at the web',
  read_core: 'Checked your Core',
  read_attachments: 'Read your documents',
  create_artifact: 'Wrote a draft',
  revise_artifact: 'Updated the draft',
  ask_user: 'Asked you',
};

const APPROVAL_VERB: Record<string, string> = {
  web_research: 'search the web',
  read_core: 'read your Core notes',
  read_attachments: 'read your attached files',
  create_artifact: 'write a draft',
  revise_artifact: 'update the draft',
};

function StepRow({ step }: { step: AgentStep }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const Icon = TOOL_ICON[step.tool] ?? Sparkles;
  const outcome =
    step.status === 'executed' ? { color: c.success, Glyph: Check }
    : step.status === 'failed' ? { color: c.danger, Glyph: X }
    : { color: c.textMuted, Glyph: CircleSlash };
  return (
    <View style={styles.stepRow}>
      <Icon size={13} color={c.textMuted} strokeWidth={1.8} />
      <Text style={styles.stepLabel} numberOfLines={2}>
        {TOOL_LABEL[step.tool] ?? step.tool}
        <Text style={styles.stepSummary}> — {step.summary}</Text>
      </Text>
      <outcome.Glyph size={13} color={outcome.color} strokeWidth={2.2} />
    </View>
  );
}

/** Soft breathing dot for the in-progress milestone. */
function PulseDot() {
  const c = useColors();
  const a = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(a, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.violet, opacity: a }} />;
}

/**
 * The live view is milestone-led: what got done, what is happening now, and a
 * Stop that always works. Blocked/failed internals stay in the receipt — the
 * user watching a running task should never have to read the state machine.
 */
export function AgentLiveCard() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const liveTask = useAgentStore((s) => s.liveTask);
  const progress = useAgentStore((s) => s.progress);
  const approval = useAgentStore((s) => s.approval);
  const question = useAgentStore((s) => s.question);
  const resolveApproval = useAgentStore((s) => s.resolveApproval);
  const resolveQuestion = useAgentStore((s) => s.resolveQuestion);
  if (!liveTask) return null;

  const milestones = liveTask.steps.filter((s) => s.status === 'executed' && s.tool !== 'finish');
  const stop = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    useChatStore.getState().stopGeneration();
  };
  const decide = (approved: boolean) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resolveApproval(approved);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <PulseDot />
        <Text style={styles.progressText}>
          {approval || question ? 'Waiting for you' : progress || 'Working on it'}
        </Text>
        <PressableScale onPress={stop} hitSlop={8}>
          <Text style={styles.stopLabel}>Stop</Text>
        </PressableScale>
      </View>

      {milestones.map((s, i) => {
        const Icon = TOOL_ICON[s.tool] ?? Sparkles;
        return (
          <View key={i} style={styles.stepRow}>
            <Icon size={13} color={c.textMuted} strokeWidth={1.8} />
            <Text style={styles.milestoneLabel} numberOfLines={1}>
              {MILESTONE[s.tool] ?? s.tool}
              <Text style={styles.stepSummary}> — {s.summary}</Text>
            </Text>
            <Check size={13} color={c.success} strokeWidth={2.2} />
          </View>
        );
      })}

      {approval && (
        <View style={styles.approval}>
          <Text style={styles.approvalTitle}>
            Aether wants to {APPROVAL_VERB[approval.tool] ?? approval.tool}
          </Text>
          {!!approval.argsSummary && <Text style={styles.approvalArgs}>{approval.argsSummary}</Text>}
          <Text style={styles.approvalWhy}>{RISK_EXPLAIN[approval.risk] ?? ''}</Text>
          <View style={styles.approvalButtons}>
            <PressableScale style={styles.allowBtn} onPress={() => decide(true)}>
              <Text style={styles.allowLabel}>Allow</Text>
            </PressableScale>
            <PressableScale style={styles.skipBtn} onPress={() => decide(false)}>
              <Text style={styles.skipLabel}>Skip</Text>
            </PressableScale>
          </View>
        </View>
      )}

      {question && (
        <QuestionCard
          question={{ question: question.question, options: question.options }}
          answered={false}
          onSelect={(opt) => resolveQuestion(opt)}
        />
      )}
    </View>
  );
}

/**
 * Task-output surface: See the real result, Keep it into local Library (durable,
 * idempotent), and Download it as a file — before or after keeping. Once kept,
 * the control settles into a quiet "Kept ✓" with a direct route to the saved
 * item. Keep never claims success before local persistence resolves.
 */
function ArtifactBlock({ taskId, artifactId, title }: {
  taskId: string; artifactId: string; title: string;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const show = useToast((s) => s.show);
  const keptInLibrary = useLibraryStore((s) => s.items.some((a) => a.id === artifactId));

  const [artifact, setArtifact] = useState<AgentArtifact | null>(null);
  const convRef = useRef<string | undefined>(undefined);
  const [preview, setPreview] = useState(false);
  const [keeping, setKeeping] = useState(false);
  const [keepFailed, setKeepFailed] = useState(false);

  const ensure = async (): Promise<AgentArtifact | null> => {
    if (artifact) return artifact;
    const task = await loadTask(taskId);
    const found = task?.artifacts.find((a) => a.id === artifactId) ?? null;
    convRef.current = task?.conversationId;
    if (found) setArtifact(found);
    return found;
  };

  const onSee = async () => {
    const a = await ensure();
    if (!a) { show('Output unavailable'); return; }
    setPreview(true);
  };

  const exportPhase = useExportStore((s) => s.exports[artifactId]?.phase);
  const exportUri = useExportStore((s) => s.exports[artifactId]?.uri);
  const exportBusy = exportPhase === 'preparing' || exportPhase === 'saving';

  const onDownload = async () => {
    if (exportBusy) return;
    if (exportPhase === 'done' && exportUri) {
      useExportStore.getState().open(exportUri);
      return;
    }
    const a = await ensure();
    if (!a) { show('Output unavailable'); return; }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void useExportStore.getState().exportArtifact({
      id: artifactId,
      title: deriveTitle(a.title, a.content),
      content: a.content,
    });
  };

  const downloadLabel =
    exportPhase === 'preparing' ? 'Preparing…'
    : exportPhase === 'saving' ? 'Saving…'
    : exportPhase === 'done' ? 'Open PDF'
    : exportPhase === 'failed' ? 'Retry PDF'
    : 'Download PDF';

  const onKeep = async () => {
    if (keeping) return;
    const a = await ensure();
    if (!a) { show('Output unavailable'); return; }
    setKeeping(true);
    setKeepFailed(false);
    try {
      await useLibraryStore.getState().keep(a, convRef.current);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      show('Kept in Library');
    } catch {
      setKeepFailed(true);
      show("Couldn't keep — tap to retry");
    } finally {
      setKeeping(false);
    }
  };

  const openInLibrary = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(main)/library/${artifactId}`);
  };

  return (
    <View style={styles.artifact}>
      <View style={styles.artifactHead}>
        <FileText size={15} color={c.violet} strokeWidth={1.8} />
        <Text style={styles.artifactTitle} numberOfLines={1}>{artifact?.title || title}</Text>
      </View>

      <View style={styles.artifactActions}>
        <PressableScale onPress={onSee} hitSlop={8}>
          <Text style={styles.artifactAction}>See</Text>
        </PressableScale>
        <PressableScale
          onPress={onDownload}
          hitSlop={8}
          disabled={exportBusy}
          style={styles.actionInline}
          accessibilityRole="button"
          accessibilityLabel="Download PDF"
          accessibilityState={{ disabled: exportBusy, busy: exportBusy }}
        >
          <Download
            size={13}
            color={exportPhase === "failed" ? c.danger : exportPhase === "done" ? c.success : c.textMuted}
            strokeWidth={1.9}
          />
          <Text
            style={[
              styles.artifactActionMuted,
              exportPhase === "done" && { color: c.success },
              exportPhase === "failed" && { color: c.danger },
            ]}
          >
            {downloadLabel}
          </Text>
        </PressableScale>

        <View style={{ flex: 1 }} />

        {keptInLibrary ? (
          <View style={styles.keptCluster}>
            <View style={styles.actionInline}>
              <Check size={13} color={c.success} strokeWidth={2.4} />
              <Text style={styles.artifactKept}>Kept</Text>
            </View>
            <PressableScale onPress={openInLibrary} hitSlop={8} style={styles.actionInline}>
              <Text style={styles.artifactAction}>Open in Library</Text>
              <ArrowUpRight size={13} color={c.violet} strokeWidth={2} />
            </PressableScale>
          </View>
        ) : (
          <PressableScale onPress={onKeep} hitSlop={8} disabled={keeping}>
            <Text style={[styles.artifactAction, keepFailed && { color: c.danger }]}>
              {keeping ? 'Keeping…' : keepFailed ? 'Retry Keep' : 'Keep'}
            </Text>
          </PressableScale>
        )}
      </View>

      <ArtifactPreviewModal visible={preview} artifact={artifact} onClose={() => setPreview(false)} />
    </View>
  );
}

const STATUS_LABEL: Record<AgentReceipt['status'], string> = {
  running: 'Running', awaiting_approval: 'Waiting for you', awaiting_user: 'Waiting for you',
  done: 'Completed', failed: 'Failed', cancelled: 'Stopped', interrupted: 'Interrupted',
};

export function AgentReceiptCard({ receipt, taskId }: { receipt: AgentReceipt; taskId: string }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);
  const executed = receipt.steps.filter((s) => s.status === 'executed').length;
  const statusColor =
    receipt.status === 'done' ? c.success
    : receipt.status === 'failed' ? c.danger
    : c.textMuted;

  return (
    <View style={styles.receipt}>
      {receipt.artifacts.map((a) => (
        <ArtifactBlock key={a.id} taskId={taskId} artifactId={a.id} title={a.title} />
      ))}
      <PressableScale onPress={() => setOpen((v) => !v)} style={styles.receiptHead} hitSlop={6}>
        <Sparkles size={12} color={c.textMuted} strokeWidth={2} />
        <Text style={styles.receiptSummary}>
          {STATUS_LABEL[receipt.status]} · {executed} step{executed === 1 ? '' : 's'}
          {receipt.sources.length ? ` · ${receipt.sources.length} source${receipt.sources.length === 1 ? '' : 's'}` : ''}
        </Text>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      </PressableScale>
      {open && (
        <View style={styles.receiptBody}>
          {receipt.steps.map((s, i) => <StepRow key={i} step={s} />)}
          {receipt.sources.map((s) => (
            <Text key={s.url} style={styles.source} numberOfLines={1}>{s.title || s.url}</Text>
          ))}
          {!!receipt.notes && <Text style={styles.notes}>{receipt.notes}</Text>}
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  card: {
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressText: { flex: 1, color: c.textMuted, ...typography.status },
  stopLabel: { color: c.danger, ...typography.chip },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepLabel: { flex: 1, color: c.text, ...typography.chip },
  milestoneLabel: { flex: 1, color: c.text, ...typography.chip },
  stepSummary: { fontFamily: typography.receipt.fontFamily, color: c.textMuted },
  approval: {
    backgroundColor: c.violetDim,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
  approvalTitle: { color: c.text, ...typography.label },
  approvalArgs: { color: c.textMuted, ...typography.caption },
  approvalWhy: { color: c.textMuted, ...typography.metadata },
  approvalButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  allowBtn: {
    backgroundColor: c.violet, borderRadius: radius.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.xl,
  },
  allowLabel: { color: c.white, ...typography.button },
  skipBtn: {
    borderWidth: 1, borderColor: c.border, borderRadius: radius.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.xl,
  },
  skipLabel: { color: c.textMuted, ...typography.button },
  receipt: { marginTop: spacing.sm, gap: spacing.sm },
  receiptHead: { flexDirection: 'row', alignItems: 'center', gap: 6, opacity: motion.pressFade },
  receiptSummary: { flex: 1, color: c.textMuted, ...typography.receipt },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  receiptBody: {
    borderLeftWidth: 2, borderLeftColor: c.separator,
    paddingLeft: spacing.md, gap: spacing.sm, marginLeft: 2,
  },
  source: { color: c.textMuted, ...typography.receipt },
  notes: { color: c.textMuted, ...typography.receipt },
  artifact: {
    backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border,
    borderRadius: radius.md, padding: spacing.md, gap: spacing.sm,
  },
  artifactHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  artifactTitle: { flex: 1, color: c.text, ...typography.label },
  artifactActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actionInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  keptCluster: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  artifactAction: { color: c.violet, ...typography.chip },
  artifactActionMuted: { color: c.textMuted, ...typography.chip },
  artifactKept: { color: c.success, ...typography.chip },
});
