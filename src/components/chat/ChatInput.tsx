import { useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/theme';

export function ChatInput({ onSend, onStop, generating, disabled }: {
  onSend: (text: string) => void; onStop: () => void; generating: boolean; disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const send = () => { const t = text.trim(); if (!t) return; setText(''); onSend(t); };
  return (
    <View style={styles.bar}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={disabled ? 'Loading model…' : 'Message Aether'}
        placeholderTextColor={colors.textMuted}
        editable={!disabled}
        multiline
      />
      {generating ? (
        <Pressable style={styles.send} onPress={onStop}><Text style={styles.sendLabel}>■</Text></Pressable>
      ) : (
        <Pressable
          style={[styles.send, (disabled || !text.trim()) && styles.disabled]}
          onPress={send}
          disabled={disabled || !text.trim()}
        >
          <Text style={styles.sendLabel}>↑</Text>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-end', padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  input: { flex: 1, maxHeight: 120, backgroundColor: colors.bgCard, borderRadius: radius.lg, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 15 },
  send: { marginLeft: spacing.sm, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  sendLabel: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
