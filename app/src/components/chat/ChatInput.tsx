import { useEffect, useMemo, useRef, useState } from 'react';
import { View, TextInput, Text, Animated, Alert, StyleSheet, Switch } from 'react-native';
import { ArrowUp, Square, Mic, Paperclip, Globe, Sparkles, X, ChevronDown, ChevronUp } from 'lucide-react-native';
import { PressableScale } from '@/components/ds/PressableScale';
import { useChatStore } from '@/state/useChatStore';
import { useAgentStore } from '@/state/useAgentStore';
import { useVoice } from '@/hooks/useVoice';
import { type AttachmentState } from '@/hooks/useAttachment';
import { AttachmentSheet } from './AttachmentSheet';
import { AttachmentChip } from './AttachmentChip';
import { ListeningWave } from './ListeningWave';
import { ModeMenu, type ChatMode } from './ModeMenu';
import { FileAttachment } from '@/types';
import { radius, spacing, Palette, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

/** Active model's vision state. Vision is built into the model: no separate pack,
 *  no download. `ready` is true once the engine has the vision graph loaded. */
export interface VisionState {
  supported: boolean;
  ready: boolean;
}

export function ChatInput({ onSend, onResearch, researchMode = false, onToggleResearch, onAct, actMode = false, onToggleAct, disabled, supportsVision = true, att, vision }: {
  onSend: (text: string, attachment?: FileAttachment) => void;
  onResearch?: (text: string) => void;
  researchMode?: boolean;
  onToggleResearch?: () => void;
  onAct?: (text: string) => void;
  actMode?: boolean;
  onToggleAct?: () => void;
  disabled?: boolean;
  /** Whether the active model can analyze images (drives the vision badge). */
  supportsVision?: boolean;
  /** Shared attachment state (lifted so the header quick-camera can use it too). */
  att: AttachmentState;
  vision?: VisionState;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [text, setText] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [taskOptionsOpen, setTaskOptionsOpen] = useState(false);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const stopGeneration = useChatStore((s) => s.stopGeneration);
  const agentMode = useAgentStore((s) => s.mode);
  const setAgentMode = useAgentStore((s) => s.setMode);

  const voice = useVoice((recognized) => {
    setText((prev) => (prev.trim() ? `${prev.trim()} ${recognized}` : recognized));
  });

  // Pulse the mic while listening (scale 1.0 -> 1.15 -> 1.0, 800 ms loop).
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!voice.listening) { pulse.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [voice.listening, pulse]);
  const micScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

  // Task's inline preferences only make sense while Task is active.
  useEffect(() => { if (!actMode) setTaskOptionsOpen(false); }, [actMode]);

  const imageAttached = att.attachment?.type === 'image';
  const visionActive = imageAttached && supportsVision && !!vision?.ready;
  const visionUnsupported = imageAttached && !supportsVision;

  const doSend = (t: string, attachment?: FileAttachment) => {
    setText('');
    att.remove();
    onSend(t, attachment);
  };

  const send = () => {
    const t = text.trim();
    if (!t && !att.attachment) return;
    if (actMode && onAct) { setText(''); onAct(t); return; }
    if (researchMode && onResearch) { setText(''); onResearch(t); return; }

    // Don't ship an image the active model can't actually see.
    const attachment = att.attachment && !(att.attachment.type === 'image' && !supportsVision)
      ? att.attachment
      : undefined;
    doSend(t, attachment);
  };

  const hasContent = !!text.trim() || (!!att.attachment && !att.processing);
  const sendDisabled = !isGenerating && (disabled || !hasContent);
  const showMic = !isGenerating && !hasContent;
  const placeholder = disabled
    ? 'Loading model...'
    : actMode ? 'Give Aether a task...'
    : researchMode ? 'Research the web...'
    : voice.listening ? 'Listening...'
    : 'Message Aether';

  const openAttach = () => setSheetOpen(true);
  const toggleVoice = () => void voice.toggle();

  const activeMode: ChatMode = actMode ? 'task' : researchMode ? 'research' : 'chat';

  const selectMode = (m: ChatMode) => {
    setModeMenuOpen(false);
    if (m === 'chat') {
      if (researchMode) onToggleResearch?.();
      else if (actMode) onToggleAct?.();
    } else if (m === 'research') {
      if (!researchMode) onToggleResearch?.();
    } else if (m === 'task') {
      if (!actMode) onToggleAct?.();
    }
  };

  const exitToChat = () => {
    if (researchMode) onToggleResearch?.();
    else if (actMode) onToggleAct?.();
  };

  const askFirst = agentMode === 'strict';
  const showModeRow = !disabled;
  const footer = researchMode || actMode
    ? 'Aether is an AI and can make mistakes.'
    : 'Aether is an AI and can make mistakes. Replies run on-device.';

  return (
    <View style={styles.wrap}>
      {/* Listening signal: moving gradient + live transcription preview */}
      {voice.listening && <ListeningWave />}
      {voice.listening && voice.partial ? (
        <View style={styles.transcript}>
          <Text style={styles.transcriptText} numberOfLines={2}>{voice.partial}</Text>
        </View>
      ) : null}

      {/* Attachment preview / processing / error */}
      {!researchMode && (
        <AttachmentChip
          attachment={att.attachment}
          processing={att.processing}
          error={att.error}
          onRemove={att.remove}
          onPressError={(m) => Alert.alert('Attachment', m)}
        />
      )}

      {/* Vision capability badge */}
      {visionActive && (
        <View style={styles.badgeRow}>
          <View style={styles.greenDot} />
          <Text style={styles.visionActive}>Vision active</Text>
        </View>
      )}
      {visionUnsupported && (
        <Text style={styles.visionWarn}>Vision not supported by this model</Text>
      )}

      {/* Voice / permission error */}
      {voice.error && <Text style={styles.voiceErr}>{voice.error}</Text>}

      {/* Mode: a quiet "Chat" trigger by default, or a compact active-mode line */}
      {showModeRow && activeMode === 'chat' && (
        <PressableScale style={styles.modeTrigger} onPress={() => setModeMenuOpen(true)} hitSlop={6}>
          <Text style={styles.modeTriggerText}>Chat</Text>
          <ChevronDown size={14} color={c.textMuted} strokeWidth={2} />
        </PressableScale>
      )}

      {showModeRow && activeMode === 'research' && (
        <View style={styles.activeModeBar}>
          <PressableScale style={styles.activeModeLeft} onPress={() => setModeMenuOpen(true)} hitSlop={4}>
            <Globe size={14} color={c.violet} strokeWidth={1.8} />
            <Text style={styles.activeModeLabel}>Research</Text>
            <Text style={styles.activeModeSub}>· Uses the web</Text>
          </PressableScale>
          <PressableScale onPress={exitToChat} hitSlop={8}>
            <X size={16} color={c.textMuted} strokeWidth={1.8} />
          </PressableScale>
        </View>
      )}

      {showModeRow && activeMode === 'task' && (
        <View style={styles.activeModeBar}>
          <PressableScale style={styles.activeModeLeft} onPress={() => setModeMenuOpen(true)} hitSlop={4}>
            <Sparkles size={14} color={c.violet} strokeWidth={1.8} />
            <Text style={styles.activeModeLabel}>Task</Text>
            <View style={styles.betaTag}>
              <Text style={styles.betaTagText}>Beta</Text>
            </View>
          </PressableScale>
          <View style={styles.activeModeRight}>
            <PressableScale onPress={() => setTaskOptionsOpen((v) => !v)} hitSlop={8}>
              {taskOptionsOpen
                ? <ChevronUp size={16} color={c.textMuted} strokeWidth={1.8} />
                : <ChevronDown size={16} color={c.textMuted} strokeWidth={1.8} />}
            </PressableScale>
            <PressableScale onPress={exitToChat} hitSlop={8}>
              <X size={16} color={c.textMuted} strokeWidth={1.8} />
            </PressableScale>
          </View>
        </View>
      )}

      {showModeRow && activeMode === 'task' && taskOptionsOpen && (
        <View style={styles.taskOptionsRow}>
          <Text style={styles.taskOptionsLabel}>Ask before actions</Text>
          <Switch
            value={askFirst}
            onValueChange={(v) => setAgentMode(v ? 'strict' : 'balanced')}
            trackColor={{ false: c.border, true: c.violet }}
            thumbColor={c.white}
          />
        </View>
      )}

      <View style={styles.row}>
        <PressableScale
          style={styles.attachBtn}
          onPress={openAttach}
          disabled={disabled || researchMode}
          hitSlop={6}
        >
          <Paperclip size={19} color={disabled || researchMode ? c.border : c.textMuted} strokeWidth={1.8} />
        </PressableScale>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={c.textMuted}
          editable={!disabled}
          multiline
        />

        {isGenerating ? (
          <PressableScale style={[styles.send, { backgroundColor: c.danger }]} onPress={stopGeneration} haptic>
            <Square size={13} color={c.white} fill={c.white} />
          </PressableScale>
        ) : showMic ? (
          <PressableScale
            style={[styles.send, styles.micBtn, voice.listening && styles.micBtnActive]}
            onPress={toggleVoice}
            disabled={disabled}
            haptic
          >
            <Animated.View style={{ transform: [{ scale: voice.listening ? micScale : 1 }] }}>
              <Mic size={18} color={voice.listening ? c.danger : c.textMuted} strokeWidth={1.8} />
            </Animated.View>
          </PressableScale>
        ) : (
          <PressableScale
            style={[styles.send, { backgroundColor: sendDisabled ? c.bgInput : c.violet }]}
            onPress={send}
            disabled={sendDisabled}
            haptic
          >
            <ArrowUp size={19} color={sendDisabled ? c.textMuted : c.white} strokeWidth={2.2} />
          </PressableScale>
        )}
      </View>

      <Text style={styles.footer}>{footer}</Text>

      <AttachmentSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCamera={att.pickCamera}
        onLibrary={att.pickLibrary}
        onFiles={att.pickFiles}
        onPaste={att.paste}
      />

      <ModeMenu
        visible={modeMenuOpen}
        onClose={() => setModeMenuOpen(false)}
        active={activeMode}
        taskAvailable={!!onToggleAct}
        onSelect={selectMode}
      />
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  wrap: { backgroundColor: c.bg, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: c.bgInput,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    color: c.text,
    paddingHorizontal: 15,
    paddingVertical: 10,
    ...typography.input,
  },
  attachBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  send: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  micBtn: { backgroundColor: c.bgInput, borderWidth: 1, borderColor: c.border },
  micBtnActive: { borderColor: c.danger },

  modeTrigger: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    gap: 3, paddingVertical: 4, paddingHorizontal: 2, marginBottom: spacing.xs,
  },
  modeTriggerText: { color: c.textMuted, ...typography.label },

  activeModeBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.violetDim, borderRadius: radius.md,
    paddingVertical: 6, paddingHorizontal: 10, marginBottom: spacing.xs,
  },
  activeModeLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  activeModeRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  activeModeLabel: { color: c.violet, ...typography.label },
  activeModeSub: { color: c.textMuted, ...typography.caption },
  betaTag: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: radius.sm, backgroundColor: c.bg },
  betaTagText: { color: c.violet, ...typography.metadata, textTransform: 'uppercase', letterSpacing: 0.4 },

  taskOptionsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, paddingHorizontal: 10, marginBottom: spacing.xs,
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border,
  },
  taskOptionsLabel: { color: c.text, ...typography.bodySmall },

  footer: { textAlign: 'center', color: c.textMuted, paddingVertical: spacing.sm, ...typography.metadata },
  transcript: { alignSelf: 'stretch', backgroundColor: c.bgInput, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm },
  transcriptText: { color: c.textMuted, ...typography.bodySmall },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm, paddingHorizontal: 2 },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.success },
  visionActive: { color: c.textMuted, ...typography.caption },
  visionWarn: { color: c.warning, marginBottom: spacing.sm, paddingHorizontal: 2, ...typography.caption },
  voiceErr: { color: c.danger, marginBottom: spacing.sm, paddingHorizontal: 2, ...typography.caption },
});
