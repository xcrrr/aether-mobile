import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, router } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { useChatStore } from '@/state/useChatStore';
import { useModelStore } from '@/state/useModelStore';
import { useProfileStore } from '@/state/useProfileStore';
import { useInference } from '@/hooks/useInference';
import { useAttachment } from '@/hooks/useAttachment';
import { getModelById, modeForModel } from '@/models/registry';
import { MessageList } from '@/components/chat/MessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { ModeSelector } from '@/components/chat/ModeSelector';
import { BrainNoticePill } from '@/components/chat/BrainNoticePill';
import { Aurora } from '@/components/ds/Aurora';
import { ModelLoadingOverlay } from '@/components/common/ModelLoadingOverlay';
import { Toast } from '@/components/common/Toast';
import { RAMWarningModal } from '@/components/settings/RAMWarningModal';
import { LOGO_PURPLE } from '@/components/ds/Logo';
import { colors, spacing, fonts } from '@/theme';

function ChatHeader({ mode, installed, onMode, onMenu, onSettings }: {
  mode: 'fast' | 'thinking';
  installed: Record<string, boolean>;
  onMode: (m: 'fast' | 'thinking') => void;
  onMenu: () => void;
  onSettings: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onMenu} hitSlop={10} style={styles.headerSide}>
        <Text style={styles.menuGlyph}>☰</Text>
      </Pressable>
      <View style={styles.headerCenter}>
        <Text style={styles.wordmark}>Aether</Text>
        <ModeSelector mode={mode} installed={installed} onSelect={onMode} />
      </View>
      <Pressable onPress={onSettings} hitSlop={10} style={styles.headerSideRight}>
        <Text style={styles.gearGlyph}>⚙</Text>
      </Pressable>
    </View>
  );
}

function EmptyState({ name }: { name: string }) {
  return (
    <View style={styles.empty}>
      <Image source={LOGO_PURPLE} style={{ width: 48, height: 48 }} resizeMode="contain" />
      <Text style={styles.greeting}>Hello, {name || 'there'}</Text>
      <Text style={styles.emptyBody}>Private, on-device AI. Start a conversation — nothing leaves your phone.</Text>
    </View>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { current, open, setCurrentModel } = useChatStore();
  const isGenerating = useChatStore((s) => s.isGenerating);
  const { installed, setActive } = useModelStore();
  const profileName = useProfileStore((s) => s.profile?.name ?? '');

  useEffect(() => { if (id) open(id); }, [id]);

  const modelId = current?.modelId;
  const model = modelId ? getModelById(modelId) : undefined;
  const { loading, error, ramWarning, loadAnyway, dismissRamWarning, send, research, vision } = useInference(modelId);
  const att = useAttachment();
  const mode = modeForModel(modelId).id;
  const [researchMode, setResearchMode] = useState(false);
  const supportsVision = model?.supportsVision ?? false;

  const onMode = (m: 'fast' | 'thinking') => {
    const target = m === 'fast' ? 'gemma4-e2b' : 'gemma4-e4b';
    if (installed[target]) {
      setActive(target);
      setCurrentModel(target);
    } else {
      router.push('/(main)/settings');
    }
  };

  // When an image is attached, re-sync vision with disk so the composer reflects
  // a pack downloaded elsewhere (Settings) without needing a reload.
  const imageAttached = att.attachment?.type === 'image';
  useEffect(() => { if (imageAttached) vision.refresh(); }, [imageAttached]);

  const empty = !current || current.messages.length === 0;

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      {/* Living purple aurora — same as onboarding — surfaces only while Aether thinks. */}
      <Aurora active={isGenerating} intensity={0.92} />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ChatHeader
          mode={mode}
          installed={installed}
          onMode={onMode}
          onMenu={() => navigation.dispatch(DrawerActions.openDrawer())}
          onSettings={() => router.push('/(main)/settings')}
        />
        {empty
          ? <EmptyState name={profileName} />
          : <MessageList messages={current!.messages} />}
        {error && <Text style={styles.err}>{error}</Text>}
        <BrainNoticePill />
        <ChatInput
          onSend={send}
          onResearch={research}
          researchMode={researchMode}
          onToggleResearch={() => setResearchMode((v) => !v)}
          disabled={loading || !!error || !!ramWarning}
          supportsVision={supportsVision}
          att={att}
          vision={vision}
        />
        {loading && model && (
          <ModelLoadingOverlay modelName={model.name} sizeLabel={model.sizeLabel} sizeGb={model.sizeBytes / 1e9} />
        )}
        <Toast />
      </KeyboardAvoidingView>
      <RAMWarningModal
        visible={!!ramWarning}
        available={ramWarning?.available ?? 0}
        required={ramWarning?.required ?? 0}
        onLoadAnyway={loadAnyway}
        onCancel={dismissRamWarning}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  headerSide: { width: 28, justifyContent: 'center' },
  headerSideRight: { width: 28, alignItems: 'flex-end', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  menuGlyph: { fontSize: 22, color: colors.text },
  gearGlyph: { fontSize: 20, color: colors.text },
  wordmark: { fontFamily: fonts.sansHeavy, fontSize: 18, color: colors.text, letterSpacing: -0.4, lineHeight: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 20 },
  greeting: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.text },
  emptyBody: { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 21, maxWidth: 260 },
  err: { color: colors.danger, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, fontSize: 13, fontFamily: fonts.sans },
});
