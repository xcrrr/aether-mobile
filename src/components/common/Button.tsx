import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, radius, spacing } from '@/theme';

export function Button({ label, onPress, disabled, loading }: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.btn, (disabled || loading) && styles.disabled]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.label}>{label}</Text>}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  btn: { backgroundColor: colors.purple, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  label: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
