import { useRef, useEffect } from 'react';
import { FlatList } from 'react-native';
import { Message } from '@/types';
import { MessageBubble } from './MessageBubble';
import { spacing } from '@/theme';

export function MessageList({ messages, onOptionSelect }: {
  messages: Message[];
  onOptionSelect?: (option: string) => void;
}) {
  const ref = useRef<FlatList<Message>>(null);
  const lastLen = messages[messages.length - 1]?.content.length ?? 0;
  useEffect(() => {
    ref.current?.scrollToEnd({ animated: true });
  }, [messages.length, lastLen]);
  return (
    <FlatList
      ref={ref}
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
      onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}
    />
  );
}
