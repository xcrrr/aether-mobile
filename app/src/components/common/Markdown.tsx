import { Fragment, useMemo } from 'react';
import { View } from 'react-native';
import { useMarkdown, type MarkedStyles } from 'react-native-marked';
import { radius, spacing, fonts, Palette, fontSize, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

/**
 * Pin a font file and cancel the library's own weight/style.
 *
 * react-native-marked merges its defaults underneath ours: `strong` carries
 * fontWeight 'bold', every heading carries fontWeight '500', and `em`, `link`
 * and `codespan` carry fontStyle 'italic'. Android cannot synthesize a face for
 * a custom font — asked for a weight or slant the family does not provide, it
 * silently falls back to the system sans. That is why bold text and headings in
 * assistant replies rendered in a completely different typeface from the body
 * around them. The weight has to come from the font file, so the style
 * properties must be neutralised rather than left to merge through.
 */
const face = (fontFamily: string) => ({
  fontFamily,
  fontWeight: 'normal' as const,
  fontStyle: 'normal' as const,
});

const makeMdStyles = (c: Palette): MarkedStyles => ({
  text: { color: c.text, ...typography.assistantBody, ...face(fonts.serif) },
  paragraph: { paddingVertical: 6 },
  strong: { color: c.text, ...face(fonts.serifBold) },
  em: face(fonts.serifItalic),
  h1: { color: c.text, ...face(fonts.serifBold), fontSize: fontSize.xl, lineHeight: 27, marginTop: 14, marginBottom: spacing.xs },
  h2: { color: c.text, ...typography.assistantHeading, ...face(fonts.serifSemibold), marginTop: 14, marginBottom: spacing.xs },
  h3: { color: c.text, ...face(fonts.serifSemibold), fontSize: fontSize.md, lineHeight: 23, marginTop: 10, marginBottom: 2 },
  h4: { color: c.text, ...face(fonts.sansSemibold), fontSize: fontSize.base, lineHeight: 21, marginTop: spacing.sm, marginBottom: 2 },
  h5: { color: c.text, ...face(fonts.serifSemibold), fontSize: fontSize.base, lineHeight: 21, marginTop: spacing.sm, marginBottom: 2 },
  h6: { color: c.text, ...face(fonts.serifSemibold), fontSize: fontSize.base, lineHeight: 21, marginTop: spacing.sm, marginBottom: 2 },
  list: { paddingVertical: 2 },
  li: { color: c.text, ...typography.assistantBody, ...face(fonts.serif) },
  blockquote: { borderLeftColor: c.violet, borderLeftWidth: 3, paddingLeft: spacing.md, opacity: 0.9 },
  hr: { backgroundColor: c.border, height: 1, marginVertical: 10 },
  code: { backgroundColor: c.codeBlock, borderRadius: radius.sm, padding: 10 },
  codespan: { color: c.textCode, backgroundColor: c.codeBlock, ...face(fonts.mono) },
  link: { color: c.purple, ...face(fonts.serif) },
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
