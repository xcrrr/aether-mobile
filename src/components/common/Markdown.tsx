import { Fragment } from 'react';
import { View } from 'react-native';
import { useMarkdown, type MarkedStyles } from 'react-native-marked';
import { colors } from '@/theme';

const mdStyles: MarkedStyles = {
  text: { color: colors.text, fontSize: 15 },
  paragraph: { paddingVertical: 2 },
  code: { backgroundColor: '#000000', borderRadius: 8, padding: 10 },
  codespan: { color: '#E2E2E2', backgroundColor: '#000000' },
  link: { color: colors.purple },
};

/**
 * Renders markdown without nesting a FlatList (uses the hook, not the component),
 * so it stays safe inside the message list's own FlatList.
 */
export function MarkdownView({ content }: { content: string }) {
  const elements = useMarkdown(content, {
    styles: mdStyles,
    theme: {
      colors: { text: colors.text, code: '#E2E2E2', link: colors.purple, border: colors.border },
    },
  });
  return (
    <View>
      {elements.map((el, i) => (
        <Fragment key={i}>{el}</Fragment>
      ))}
    </View>
  );
}
