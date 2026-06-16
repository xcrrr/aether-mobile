import { useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useChatStore } from '@/state/useChatStore';
import { useInference } from '@/hooks/useInference';
import { getModelById } from '@/models/registry';
import { MessageList } from '@/components/chat/MessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { ModelLoadingOverlay } from '@/components/common/ModelLoadingOverlay';
import { colors, spacing } from '@/theme';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { current, open, generating } = useChatStore();
  useEffect(() => { if (id) open(id); }, [id]);

  const modelId = current?.modelId;
  const model = modelId ? getModelById(modelId) : undefined;
  const { loading, error, send, stop } = useInference(modelId);

  return (
    <KeyboardAvoidingView style={styles.c} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {current && <MessageList messages={current.messages} />}
      {generating && <View style={{ paddingHorizontal: spacing.lg }}><TypingIndicator /></View>}
      {error && <Text style={styles.err}>{error}</Text>}
      <ChatInput onSend={send} onStop={stop} generating={generating} disabled={loading || !!error} />
      {loading && model && (
        <ModelLoadingOverlay modelName={model.name} sizeLabel={model.sizeLabel} sizeGb={model.sizeBytes / 1e9} />
      )}
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  err: { color: colors.danger, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, fontSize: 13 },
});
