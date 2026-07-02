import { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { spacing, radius, fonts, Palette, fontSize } from '@/theme';
import { useColors } from '@/theme/useColors';

type Tone = 'neutral' | 'accent' | 'blue' | 'danger';

const makeTones = (c: Palette): Record<Tone, { bg: string; color: string; border: string }> => ({
  neutral: { bg: c.assistantBubble, color: c.textMuted, border: c.border },
  accent: { bg: c.bgInput, color: c.violet, border: c.border },
  blue: { bg: c.bgInput, color: c.textMuted, border: c.border },
  danger: { bg: c.dangerBg, color: c.danger, border: 'transparent' },
});

export function Badge({ label, tone = 'neutral', style }: { label: string; tone?: Tone; style?: ViewStyle }) {
  const c = useColors();
  const t = useMemo(() => makeTones(c), [c])[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      <Text style={[styles.label, { color: t.color }]}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  label: { fontFamily: fonts.sansSemibold, fontSize: fontSize.xs, lineHeight: 14 },
});
