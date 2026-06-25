import { Fragment, useMemo } from 'react';
import { View } from 'react-native';
import { useMarkdown, type MarkedStyles } from 'react-native-marked';
import { fonts, Palette } from '@/theme';
import { useColors } from '@/theme/useColors';

const makeMdStyles = (c: Palette): MarkedStyles => ({
  // Assistant body text — Literata serif, for an editorial, human reading feel.
  text: { color: c.text, fontSize: 15, lineHeight: 23, fontFamily: fonts.serif },
  paragraph: { paddingVertical: 4 },
  strong: { fontFamily: fonts.displayBold, color: c.text },
  em: { fontFamily: fonts.serif, fontStyle: 'italic' },
  // Headings — Literata serif for an editorial, human feel (like Claude).
  h1: { color: c.text, fontFamily: fonts.displayBold, fontSize: 21, lineHeight: 28, marginTop: 14, marginBottom: 4 },
  h2: { color: c.text, fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 25, marginTop: 14, marginBottom: 4 },
  h3: { color: c.text, fontFamily: fonts.display, fontSize: 16, lineHeight: 22, marginTop: 10, marginBottom: 2 },
  h4: { color: c.text, fontFamily: fonts.sansSemibold, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 2 },
  list: { paddingVertical: 2 },
  li: { color: c.text, fontSize: 15, lineHeight: 23, fontFamily: fonts.serif },
  blockquote: { borderLeftColor: c.violet, borderLeftWidth: 3, paddingLeft: 12, opacity: 0.9 },
  hr: { backgroundColor: c.border, height: 1, marginVertical: 10 },
  code: { backgroundColor: c.codeBlock, borderRadius: 8, padding: 10 },
  codespan: { color: c.textCode, backgroundColor: c.codeBlock },
  link: { color: c.purple },
});

/**
 * Renders markdown without nesting a FlatList (uses the hook, not the component),
 * so it stays safe inside the message list's own FlatList.
 */
export function MarkdownView({ content }: { content: string }) {
  const c = useColors();
  const mdStyles = useMemo(() => makeMdStyles(c), [c]);
  const elements = useMarkdown(content, {
    styles: mdStyles,
    theme: {
      colors: { text: c.text, code: c.textCode, link: c.purple, border: c.border },
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
