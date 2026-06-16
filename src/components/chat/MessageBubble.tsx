import { View, Text, StyleSheet } from 'react-native';
import { Message } from '@/types';
import { MarkdownView } from '@/components/common/Markdown';
import { colors, radius, spacing } from '@/theme';

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.right : styles.left]}>
      <View style={[styles.bubble, isUser ? styles.user : styles.assistant]}>
        {isUser
          ? <Text style={styles.userText}>{message.content}</Text>
          : <MarkdownView content={message.content || '…'} />}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { marginBottom: spacing.md, flexDirection: 'row' },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  user: { backgroundColor: colors.userBubble },
  assistant: { backgroundColor: colors.assistantBubble },
  userText: { color: '#fff', fontSize: 15 },
});
