import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, fonts } from '@/theme';

type Tone = 'neutral' | 'accent' | 'blue' | 'danger';

const tones: Record<Tone, { bg: string; color: string; border: string }> = {
  neutral: { bg: colors.assistantBubble, color: colors.textMuted, border: colors.border },
  accent: { bg: 'rgba(124,58,237,0.16)', color: colors.violet, border: 'rgba(124,58,237,0.35)' },
  blue: { bg: 'rgba(66,133,244,0.16)', color: colors.blue, border: 'rgba(66,133,244,0.35)' },
  danger: { bg: colors.dangerBg, color: colors.danger, border: 'transparent' },
};

export function Badge({ label, tone = 'neutral', style }: { label: string; tone?: Tone; style?: ViewStyle }) {
  const t = tones[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      <Text style={[styles.label, { color: t.color }]}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  label: { fontFamily: fonts.sansSemibold, fontSize: 11, lineHeight: 14 },
});
