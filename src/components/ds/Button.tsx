import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { colors, radius, fonts } from '@/theme';

type Variant = 'primary' | 'secondary' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, { bg: string; color: string; border: string }> = {
  primary: { bg: colors.violet, color: colors.white, border: 'transparent' },
  secondary: { bg: 'transparent', color: colors.text, border: colors.border },
  danger: { bg: colors.dangerBg, color: colors.danger, border: 'transparent' },
};

const pads: Record<Size, { v: number; h: number; fs: number }> = {
  sm: { v: 8, h: 12, fs: 13 },
  md: { v: 12, h: 16, fs: 15 },
  lg: { v: 16, h: 20, fs: 16 },
};

export function Button({ label, onPress, variant = 'primary', size = 'md', block = true, disabled, loading, style }: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const v = variants[variant];
  const p = pads[size];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: v.bg, borderColor: v.border,
          paddingVertical: p.v, paddingHorizontal: p.h,
          alignSelf: block ? 'stretch' : 'flex-start',
          opacity: disabled || loading ? 0.45 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={v.color} />
        : <Text style={[styles.label, { color: v.color, fontSize: p.fs }]}>{label}</Text>}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  btn: { borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.sansBold },
});
