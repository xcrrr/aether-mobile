import { useMemo } from 'react';
import { Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { PressableScale } from './PressableScale';
import { radius, Palette, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

type Variant = 'primary' | 'secondary' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const makeVariants = (c: Palette): Record<Variant, { bg: string; color: string; border: string }> => ({
  primary: { bg: c.violet, color: c.white, border: 'transparent' },
  secondary: { bg: 'transparent', color: c.text, border: c.border },
  danger: { bg: c.dangerBg, color: c.danger, border: 'transparent' },
});

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
  const c = useColors();
  const v = useMemo(() => makeVariants(c), [c])[variant];
  const p = pads[size];
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic={variant === 'primary'}
      style={[
        styles.btn,
        {
          backgroundColor: v.bg, borderColor: v.border,
          paddingVertical: p.v, paddingHorizontal: p.h,
          alignSelf: block ? 'stretch' : 'flex-start',
          opacity: disabled || loading ? 0.45 : 1,
        },
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={v.color} />
        : <Text style={[styles.label, { color: v.color, fontSize: p.fs }]}>{label}</Text>}
    </PressableScale>
  );
}
const styles = StyleSheet.create({
  btn: { borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: typography.button.fontFamily, lineHeight: typography.button.lineHeight },
});
