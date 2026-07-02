import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Copy, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { PressableScale } from '@/components/ds/PressableScale';
import { radius, spacing, fonts, Palette, fontSize, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

/**
 * A self-contained copyable deliverable: a code-tinted, bordered block with a
 * small copy button in the top-right. Used for <copy> blocks (plain text) and
 * fenced code (monospace, optional language label). Content is rendered verbatim,
 * never as markdown, since it is meant to be copied as-is.
 *
 * While the block is still streaming in (`pending`), the card renders and fills
 * live but the copy button is withheld — a half-artifact must not be copyable.
 */
export function CopyBlock({ content, mono = false, lang, pending = false }: {
  content: string;
  mono?: boolean;
  lang?: string;
  pending?: boolean;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
    await Clipboard.setStringAsync(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [content]);

  const body = (
    <Text style={[styles.text, mono && styles.mono]} selectable>
      {content}
    </Text>
  );

  return (
    <View style={styles.card}>
      {!!lang && <Text style={styles.lang}>{lang}</Text>}
      {!pending && (
        <PressableScale onPress={onCopy} hitSlop={10} style={styles.copyBtn} accessibilityLabel="Copy">
          {copied
            ? <Check size={15} color={c.success} strokeWidth={2.2} />
            : <Copy size={15} color={c.textMuted} strokeWidth={1.8} />}
        </PressableScale>
      )}
      {mono
        ? <ScrollView horizontal showsHorizontalScrollIndicator={false}>{body}</ScrollView>
        : body}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  card: {
    backgroundColor: c.codeBlock,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    paddingRight: 38,
    marginVertical: spacing.sm,
  },
  copyBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  lang: { color: c.textMuted, marginBottom: 6, ...typography.metadata },
  text: { color: c.textCode, fontSize: fontSize.sm2, lineHeight: 20, fontFamily: fonts.mono },
  mono: { fontFamily: fonts.mono, fontSize: fontSize.sm2, lineHeight: 20 },
});
