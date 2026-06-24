import { Component, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '@/theme';

/**
 * Catches any render/runtime error inside the graph so a crash shows a readable
 * message instead of blanking the whole Second Brain screen to a gray background.
 */
export class GraphErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.box}>
          <Text style={styles.title}>The graph hit an error</Text>
          <Text style={styles.msg}>{String(this.state.error?.message ?? this.state.error)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: 6 },
  title: { color: colors.text, fontSize: 14, fontFamily: fonts.sansSemibold },
  msg: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.mono, textAlign: 'center' },
});
