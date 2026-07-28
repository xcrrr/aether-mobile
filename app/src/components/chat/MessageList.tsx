import { useCallback, useEffect, useRef } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Message } from '@/types';
import { MessageBubble } from './MessageBubble';
import { spacing } from '@/theme';

/** How close to the bottom still counts as "following the conversation", in px. */
const AT_BOTTOM_SLOP = 80;

export function MessageList({ messages, onOptionSelect }: {
  messages: Message[];
  onOptionSelect?: (option: string, messageId: string) => void;
}) {
  const listRef = useRef<FlatList<Message>>(null);
  const atBottom = useRef(true);

  const last = messages[messages.length - 1];
  const lastSentId = last?.role === 'user' ? last.id : null;

  // Sending is an explicit intent to see the newest turn, so it always wins over
  // wherever the user had scrolled back to read history.
  useEffect(() => {
    if (!lastSentId) return;
    atBottom.current = true;
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 0);
    return () => clearTimeout(t);
  }, [lastSentId]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    atBottom.current =
      contentSize.height - layoutMeasurement.height - contentOffset.y <= AT_BOTTOM_SLOP;
  }, []);

  // Streaming grows the content under the reader. Follow it only for someone already
  // at the bottom — scrolling up to read is deliberate and must not be undone.
  const onContentSizeChange = useCallback(() => {
    if (atBottom.current) listRef.current?.scrollToEnd({ animated: true });
  }, []);

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={(m) => m.id}
      renderItem={({ item, index }) => (
        <MessageBubble
          message={item}
          isLast={index === messages.length - 1}
          onOptionSelect={onOptionSelect}
        />
      )}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onContentSizeChange={onContentSizeChange}
      contentContainerStyle={{ padding: spacing.lg }}
    />
  );
}
