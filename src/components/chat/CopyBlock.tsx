import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Copy, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { radius, spacing, fonts, Palette } from '@/theme';
import { useColors } from '@/theme/useColors';

/**
 * A self-contained copyable deliverable — a code-tinted, bordered card with a
 * small copy button in the top-right. Used for <copy> blocks (plain text) and
 * fenced code (monospace, optional language label). Content is rendered verbatim,
 * never as markdown, since it is meant to be copied as-is.
 */
export function CopyBlock({ content, mono = false, lang }: {
  content: string;
  mono?: boolean;
  lang?: string;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      <Pressable onPress={onCopy} hitSlop={10} style={styles.copyBtn}>
        {copied
          ? <Check size={15} color={c.success} strokeWidth={2.2} />
          : <Copy size={15} color={c.textMuted} strokeWidth={1.8} />}
      </Pressable>
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
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  lang: { fontFamily: fonts.sans, fontSize: 11, color: c.textMuted, marginBottom: 6 },
  text: { color: c.textCode, fontSize: 14, lineHeight: 21, fontFamily: fonts.sans },
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 20 },
});
