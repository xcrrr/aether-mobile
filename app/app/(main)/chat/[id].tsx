import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, router } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { Menu, Plus } from 'lucide-react-native';
import { Button } from '@/components/ds/Button';
import { PressableScale } from '@/components/ds/PressableScale';
import { LegalDocumentModal } from '@/components/legal/LegalDocumentModal';
import { acceptLegalDocument } from '@/legal/acceptance';
import { getLegalDocument } from '@/legal/documents';
import { getResearchDisclosureAction } from '@/legal/researchDisclosure';
import { TASK_UI_ENABLED } from '@/release/features';
import { useChatStore } from '@/state/useChatStore';
import { useModelStore } from '@/state/useModelStore';
import { useProfileStore } from '@/state/useProfileStore';
import { useInference } from '@/hooks/useInference';
import { useAttachment } from '@/hooks/useAttachment';
import { getModelById, modeForModel } from '@/models/registry';
import { FileAttachment } from '@/types';
import { MessageList } from '@/components/chat/MessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { ModeSelector } from '@/components/chat/ModeSelector';
import { BrainNoticePill } from '@/components/chat/BrainNoticePill';
import { ModelLoadingOverlay } from '@/components/common/ModelLoadingOverlay';
import { Toast } from '@/components/common/Toast';
import { RAMWarningModal } from '@/components/settings/RAMWarningModal';
import { LOGO_PURPLE } from '@/components/ds/Logo';
import { spacing, fonts, Palette, fontSize } from '@/theme';
import { useColors } from '@/theme/useColors';

function ChatHeader({ mode, installed, onMode, onMenu, onNewChat }: {
  mode: 'fast' | 'thinking';
  installed: Record<string, boolean>;
  onMode: (m: 'fast' | 'thinking') => void;
  onMenu: () => void;
  onNewChat: () => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.header}>
      <PressableScale onPress={onMenu} hitSlop={10} style={styles.headerSide}>
        <Menu size={22} color={c.text} strokeWidth={2} />
      </PressableScale>
      <View style={styles.headerCenter}>
        <Text style={styles.wordmark}>Aether</Text>
        <ModeSelector mode={mode} installed={installed} onSelect={onMode} />
      </View>
      <PressableScale
        onPress={onNewChat}
        hitSlop={10}
        style={styles.headerSideRight}
        accessibilityRole="button"
        accessibilityLabel="New chat"
      >
        <Plus size={21} color={c.text} strokeWidth={2.1} />
      </PressableScale>
    </View>
  );
}

function EmptyState({ name }: { name: string }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a]);
  const enter = { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] };
  return (
    <Animated.View style={[styles.empty, enter]}>
      <Image source={LOGO_PURPLE} style={{ width: 48, height: 48 }} resizeMode="contain" />
      <Text style={styles.greeting}>Hello, {name || 'there'}</Text>
      <Text style={styles.emptyBody}>Ask a question, attach a file, or start with a rough idea.</Text>
    </Animated.View>
  );
}

export default function ChatScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { current, open, setCurrentModel, newChat } = useChatStore();
  const { installed, setActive } = useModelStore();
  const profileName = useProfileStore((s) => s.profile?.name ?? '');
  const legalAcceptance = useProfileStore((s) => s.legalAcceptance);
  const refreshLegalAcceptance = useProfileStore((s) => s.refreshLegalAcceptance);

  useEffect(() => { if (id) open(id); }, [id]);

  const modelId = current?.modelId;
  const model = modelId ? getModelById(modelId) : undefined;
  const modelReady = !!modelId && !!installed[modelId];
  const { loading, error, ramWarning, loadAnyway, dismissRamWarning, send, research, act, vision } = useInference(modelReady ? modelId : undefined);
  const att = useAttachment();
  const mode = modeForModel(modelId).id;
  const [researchMode, setResearchMode] = useState(false);
  const [pendingOnlineAction, setPendingOnlineAction] = useState<{
    kind: 'research' | 'act';
    text: string;
    attachment?: FileAttachment;
  } | null>(null);
  const [showResearchDisclosure, setShowResearchDisclosure] = useState(false);
  const [actMode, setActMode] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const supportsVision = model?.supportsVision ?? false;

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    if (loading) {
      setShowLoadingOverlay(true);
      setLoadingComplete(false);
    } else if (showLoadingOverlay) {
      setLoadingComplete(true);
      timeout = setTimeout(() => {
        setShowLoadingOverlay(false);
        setLoadingComplete(false);
      }, 980);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [loading, showLoadingOverlay]);

  const onMode = (m: 'fast' | 'thinking') => {
    const target = m === 'fast' ? 'gemma4-e2b' : 'gemma4-e4b';
    if (installed[target]) {
      setActive(target);
      setCurrentModel(target);
    } else {
      router.push('/(main)/settings');
    }
  };

  const onNewChat = async () => {
    if (!modelId || !modelReady) {
      router.push('/(main)/settings');
      return;
    }
    const nextId = await newChat(modelId);
    router.push(`/(main)/chat/${nextId}`);
  };

  const runOnlineWithDisclosure = (
    kind: 'research' | 'act',
    text: string,
    attachment?: FileAttachment,
  ) => {
    if (getResearchDisclosureAction(legalAcceptance) === 'show-disclosure') {
      setPendingOnlineAction({ kind, text, attachment });
      setShowResearchDisclosure(true);
      return;
    }
    void (kind === 'research' ? research(text) : act(text, undefined, attachment));
  };

  const acceptResearchDisclosure = async () => {
    const pending = pendingOnlineAction;
    await acceptLegalDocument('research-disclosure');
    await refreshLegalAcceptance();
    setPendingOnlineAction(null);
    setShowResearchDisclosure(false);
    if (pending) {
      void (pending.kind === 'research'
        ? research(pending.text)
        : act(pending.text, undefined, pending.attachment));
    }
  };

  // Declining never swallows the message: research falls back to ordinary
  // local chat, a task still runs with web access off (enforced in code).
  const declineResearchDisclosure = () => {
    const pending = pendingOnlineAction;
    setPendingOnlineAction(null);
    setShowResearchDisclosure(false);
    if (!pending) return;
    if (pending.kind === 'research') void send(pending.text);
    else void act(pending.text, { researchAllowed: false }, pending.attachment);
  };

  const empty = !current || current.messages.length === 0;

  // Answering a question card: persist the pick first (survives restart), then
  // send it as the user's turn. Ignored while a reply is still streaming so a
  // tap can never cancel an in-flight generation.
  const onOptionSelect = (option: string, messageId: string) => {
    const store = useChatStore.getState();
    if (store.isGenerating) return;
    store.recordQuestionAnswer(messageId, option);
    void send(option);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          enabled={Platform.OS === 'ios'}
        >
          <ChatHeader
            mode={mode}
            installed={installed}
            onMode={onMode}
            onMenu={() => navigation.dispatch(DrawerActions.openDrawer())}
            onNewChat={onNewChat}
          />
          {empty
            ? <EmptyState name={profileName} />
            : <MessageList messages={current!.messages} onOptionSelect={onOptionSelect} />}
          {!modelReady && <Text style={styles.err}>Download a model in Settings to use this chat.</Text>}
          {error && <Text style={styles.err}>{error}</Text>}
          <BrainNoticePill />
          <ChatInput
            onSend={send}
            onResearch={(text) => runOnlineWithDisclosure('research', text)}
            researchMode={researchMode}
            onToggleResearch={() => { setResearchMode((v) => !v); setActMode(false); }}
            onAct={TASK_UI_ENABLED ? (text, attachment) => runOnlineWithDisclosure('act', text, attachment) : undefined}
            actMode={TASK_UI_ENABLED && actMode}
            onToggleAct={TASK_UI_ENABLED ? () => { setActMode((v) => !v); setResearchMode(false); } : undefined}
            disabled={!modelReady || loading || !!error || !!ramWarning}
            supportsVision={supportsVision}
            att={att}
            vision={vision}
          />
          {showLoadingOverlay && model && (
            <ModelLoadingOverlay
              modelName={model.name}
              sizeLabel={model.sizeLabel}
              sizeGb={model.sizeBytes / 1e9}
              complete={loadingComplete}
            />
          )}
          <Toast />
          <LegalDocumentModal
            document={getLegalDocument('research-disclosure')}
            visible={showResearchDisclosure}
            onClose={declineResearchDisclosure}
            footer={(
              <>
                <Button label="Use Research" onPress={acceptResearchDisclosure} />
                <Button label="Stay in local chat" onPress={declineResearchDisclosure} variant="secondary" />
              </>
            )}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
      <RAMWarningModal
        visible={!!ramWarning}
        available={ramWarning?.available ?? 0}
        required={ramWarning?.required ?? 0}
        onLoadAnyway={loadAnyway}
        onCancel={dismissRamWarning}
      />
    </View>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  c: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: 14, paddingVertical: spacing.md },
  headerSide: { width: 28, justifyContent: 'center' },
  headerSideRight: { width: 28, alignItems: 'flex-end', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  wordmark: { fontFamily: fonts.displayBold, fontSize: fontSize.xl, color: c.text, lineHeight: 23 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 20 },
  greeting: { fontFamily: fonts.displayBold, fontSize: fontSize.xxl, color: c.text },
  emptyBody: { fontFamily: fonts.sans, fontSize: fontSize.base, color: c.textMuted, textAlign: 'center', lineHeight: 21, maxWidth: 260 },
  err: { color: c.danger, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, fontSize: fontSize.sm2, fontFamily: fonts.sans },
});
