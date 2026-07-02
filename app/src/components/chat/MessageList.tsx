import { FlatList } from 'react-native';
import { Message } from '@/types';
import { MessageBubble } from './MessageBubble';
import { spacing } from '@/theme';

export function MessageList({ messages, onOptionSelect }: {
  messages: Message[];
  onOptionSelect?: (option: string, messageId: string) => void;
}) {
  return (
    <FlatList
      data={messages}
      keyExtractor={(m) => m.id}
      renderItem={({ item, index }) => (
        <MessageBubble
          message={item}
          isLast={index === messages.length - 1}
          onOptionSelect={onOptionSelect}
        />
      )}
      contentContainerStyle={{ padding: spacing.lg }}
    />
  );
}
