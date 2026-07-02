import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '@/theme';

type Props = {
  children: ReactNode;
  backgroundColor: string;
  textColor: string;
  mutedColor: string;
};

type State = {
  error: Error | null;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.warn('Aether render failed', error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={[styles.root, { backgroundColor: this.props.backgroundColor }]}>
        <Text style={[styles.title, { color: this.props.textColor }]}>Aether could not start</Text>
        <Text style={[styles.body, { color: this.props.mutedColor }]}>
          Close and reopen the app. If it keeps happening, Android logs will show the exact startup error.
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  title: {
    ...typography.screenTitle,
    textAlign: 'center',
  },
  body: {
    marginTop: spacing.sm,
    ...typography.bodySmall,
    textAlign: 'center',
  },
});
