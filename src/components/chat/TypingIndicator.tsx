import { Text, StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme';

export function TypingIndicator() {
  return <Text style={styles.t}>Aether is thinking…</Text>;
}
const styles = StyleSheet.create({
  t: { color: colors.textMuted, fontStyle: 'italic', marginBottom: spacing.sm },
});
