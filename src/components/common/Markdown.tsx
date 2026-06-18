import { Fragment } from 'react';
import { View } from 'react-native';
import { useMarkdown, type MarkedStyles } from 'react-native-marked';
import { colors, fonts } from '@/theme';

const mdStyles: MarkedStyles = {
  text: { color: colors.text, fontSize: 15, lineHeight: 22, fontFamily: fonts.sans },
  paragraph: { paddingVertical: 4 },
  strong: { fontFamily: fonts.sansBold, color: colors.text },
  em: { fontFamily: fonts.sans, fontStyle: 'italic' },
  // Headings — clear visual hierarchy, like a written explanation.
  h1: { color: colors.text, fontFamily: fonts.sansHeavy, fontSize: 22, lineHeight: 28, marginTop: 12, marginBottom: 4 },
  h2: { color: colors.text, fontFamily: fonts.sansBold, fontSize: 19, lineHeight: 25, marginTop: 12, marginBottom: 4 },
  h3: { color: colors.text, fontFamily: fonts.sansBold, fontSize: 16, lineHeight: 22, marginTop: 10, marginBottom: 2 },
  h4: { color: colors.text, fontFamily: fonts.sansSemibold, fontSize: 15, lineHeight: 21, marginTop: 8, marginBottom: 2 },
  list: { paddingVertical: 2 },
  li: { color: colors.text, fontSize: 15, lineHeight: 22, fontFamily: fonts.sans },
  blockquote: { borderLeftColor: colors.violet, borderLeftWidth: 3, paddingLeft: 12, opacity: 0.9 },
  hr: { backgroundColor: colors.border, height: 1, marginVertical: 10 },
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
