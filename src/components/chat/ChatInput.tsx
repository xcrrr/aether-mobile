import { useEffect, useRef, useState } from 'react';
import { View, TextInput, Pressable, Text, Animated, Alert, StyleSheet } from 'react-native';
import { ArrowUp, Square, Mic, Paperclip, Globe, Plus, X } from 'lucide-react-native';
import { useChatStore } from '@/state/useChatStore';
import { useVoice } from '@/hooks/useVoice';
import { type AttachmentState } from '@/hooks/useAttachment';
import { AttachmentSheet } from './AttachmentSheet';
import { AttachmentChip } from './AttachmentChip';
import { ListeningWave } from './ListeningWave';
import { FileAttachment } from '@/types';
import { colors, radius, spacing, fonts } from '@/theme';

/** Active model's vision state. Vision is built into the model — no separate pack,
 *  no download. `ready` is true once the engine has the vision graph loaded. */
export interface VisionState {
  supported: boolean;
  ready: boolean;
}

export function ChatInput({ onSend, onResearch, researchMode = false, onToggleResearch, disabled, supportsVision = true, att, vision }: {
  onSend: (text: string, attachment?: FileAttachment) => void;
  onResearch?: (text: string) => void;
  researchMode?: boolean;
  onToggleResearch?: () => void;
  disabled?: boolean;
  /** Whether the active model can analyze images (drives the vision badge). */
  supportsVision?: boolean;
  /** Shared attachment state (lifted so the header quick-camera can use it too). */
  att: AttachmentState;
  vision?: VisionState;
}) {
  const [text, setText] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [barOpen, setBarOpen] = useState(false);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const stopGeneration = useChatStore((s) => s.stopGeneration);

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
    if (researchMode && onResearch) { setText(''); onResearch(t); return; }

    // Don't ship an image the active model can't actually see.
    const attachment = att.attachment && !(att.attachment.type === 'image' && !supportsVision)
      ? att.attachment
      : undefined;
    doSend(t, attachment);
  };

  const canSend = !!text.trim() || (!!att.attachment && !att.processing);
  const sendDisabled = !isGenerating && (disabled || !canSend);
  const placeholder = disabled
    ? 'Loading model…'
    : researchMode ? 'Research the web…'
    : voice.listening ? 'Listening…'
    : 'Message Aether';

  const openAttach = () => { setBarOpen(false); setSheetOpen(true); };
  // Keep the actions bar open while research is on so the active toggle stays
  // visible — otherwise the user can't tell research is engaged.
  const toggleResearch = () => onToggleResearch?.();
  const toggleVoice = () => { setBarOpen(false); void voice.toggle(); };

  // Force the bar open whenever research is active, regardless of manual collapse.
  const showBar = (barOpen || researchMode) && !disabled;

  return (
    <View style={styles.wrap}>
      {/* Listening signal — moving gradient + live transcription preview */}
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

      {/* Collapsible actions bar (Claude-style "+") */}
      {showBar && (
        <View style={styles.actionsBar}>
          <ActionPill icon={<Paperclip size={18} color={researchMode ? colors.border : colors.text} strokeWidth={2} />} label="Attach" onPress={openAttach} disabled={researchMode} />
          <ActionPill icon={<Globe size={18} color={researchMode ? colors.violet : colors.text} strokeWidth={2} />} label="Research" active={researchMode} onPress={toggleResearch} />
          <ActionPill icon={<Mic size={18} color={voice.listening ? colors.danger : colors.text} strokeWidth={2} />} label={voice.listening ? 'Listening' : 'Voice'} active={voice.listening} onPress={toggleVoice} />
        </View>
      )}

      <View style={styles.row}>
        <Pressable
          style={[styles.plusBtn, showBar && styles.plusBtnOpen]}
          onPress={() => setBarOpen((v) => !v)}
          disabled={disabled}
          hitSlop={6}
        >
          {showBar
            ? <X size={20} color={colors.text} strokeWidth={2.2} />
            : <Plus size={22} color={disabled ? colors.border : colors.textMuted} strokeWidth={2.2} />}
        </Pressable>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          editable={!disabled}
          multiline
        />

        <Pressable
          style={[
            styles.send,
            { backgroundColor: isGenerating ? colors.danger : sendDisabled ? colors.bgCard : colors.violet },
          ]}
          onPress={isGenerating ? stopGeneration : send}
          disabled={sendDisabled}
        >
          {isGenerating
            ? <Square size={14} color={colors.white} fill={colors.white} />
            : <ArrowUp size={20} color={colors.white} strokeWidth={2.4} />}
        </Pressable>
      </View>

      <Text style={styles.footer}>Aether is an AI and can make mistakes. Replies run on-device.</Text>

      <AttachmentSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCamera={att.pickCamera}
        onLibrary={att.pickLibrary}
        onFiles={att.pickFiles}
        onPaste={att.paste}
      />
    </View>
  );
}

function ActionPill({ icon, label, onPress, active, disabled }: {
  icon: React.ReactNode; label: string; onPress: () => void; active?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.pill, active && styles.pillActive, disabled && styles.pillDisabled]}
      hitSlop={4}
    >
      {icon}
      <Text style={[styles.pillLabel, active && { color: colors.violet }, disabled && { color: colors.border }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, maxHeight: 120, backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, color: colors.text, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, fontFamily: fonts.sans, lineHeight: 22 },
  plusBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard },
  plusBtnOpen: { borderColor: colors.violet, backgroundColor: colors.assistantBubble },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actionsBar: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard },
  pillActive: { borderColor: colors.violet, backgroundColor: colors.assistantBubble },
  pillDisabled: { opacity: 0.5 },
  pillLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.text },
  footer: { textAlign: 'center', fontSize: 11, color: colors.textMuted, paddingVertical: spacing.sm, fontFamily: fonts.sans },
  transcript: { alignSelf: 'stretch', backgroundColor: colors.assistantBubble, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm },
  transcriptText: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.sans, lineHeight: 18 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm, paddingHorizontal: 2 },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  visionActive: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
  visionWarn: { fontFamily: fonts.sans, fontSize: 12, color: '#EAB308', marginBottom: spacing.sm, paddingHorizontal: 2 },
  voiceErr: { fontFamily: fonts.sans, fontSize: 12, color: colors.danger, marginBottom: spacing.sm, paddingHorizontal: 2 },
});
