import { Fragment, useMemo } from 'react';
import { View } from 'react-native';
import { useMarkdown, type MarkedStyles } from 'react-native-marked';
import { radius, spacing, fonts, Palette, fontSize, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

const makeMdStyles = (c: Palette): MarkedStyles => ({
  text: { color: c.text, ...typography.assistantBody },
  paragraph: { paddingVertical: 6 },
  strong: { fontFamily: fonts.display, color: c.text },
  em: { fontFamily: fonts.serifItalic },
  h1: { color: c.text, fontFamily: fonts.display, fontSize: fontSize.xl, lineHeight: 27, marginTop: 14, marginBottom: spacing.xs },
  h2: { color: c.text, ...typography.assistantHeading, marginTop: 14, marginBottom: spacing.xs },
  h3: { color: c.text, fontFamily: fonts.display, fontSize: fontSize.md, lineHeight: 23, marginTop: 10, marginBottom: 2 },
  h4: { color: c.text, fontFamily: fonts.sansSemibold, fontSize: fontSize.base, lineHeight: 21, marginTop: spacing.sm, marginBottom: 2 },
  list: { paddingVertical: 2 },
  li: { color: c.text, ...typography.assistantBody },
  blockquote: { borderLeftColor: c.violet, borderLeftWidth: 3, paddingLeft: spacing.md, opacity: 0.9 },
  hr: { backgroundColor: c.border, height: 1, marginVertical: 10 },
  code: { backgroundColor: c.codeBlock, borderRadius: radius.sm, padding: 10 },
  codespan: { color: c.textCode, backgroundColor: c.codeBlock, fontFamily: fonts.mono },
  link: { color: c.purple },
});

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
