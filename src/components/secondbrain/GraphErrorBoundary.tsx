import { Component, ReactNode, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fonts, spacing, Palette } from '@/theme';
import { useColors } from '@/theme/useColors';

function GraphErrorView({ message }: { message: string }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.box}>
      <Text style={styles.title}>The graph hit an error</Text>
      <Text style={styles.msg}>{message}</Text>
    </View>
  );
}

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
      return <GraphErrorView message={String(this.state.error?.message ?? this.state.error)} />;
    }
    return this.props.children;
  }
}

const makeStyles = (c: Palette) => StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: 6 },
  title: { color: c.text, fontSize: 14, fontFamily: fonts.sansSemibold },
  msg: { color: c.textMuted, fontSize: 12, fontFamily: fonts.mono, textAlign: 'center' },
});
