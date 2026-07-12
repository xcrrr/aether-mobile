import { useMemo } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { MarkdownView } from '@/components/common/Markdown';
import { spacing } from '@/theme';

/**
 * Faithful, read-only rendering of a saved Task output. Renders the artifact's
 * markdown exactly, with correct wrapping and vertical scroll. No edit mode, no
 * chrome — the surrounding screen owns the header and actions.
 */
export function ArtifactReader({ content, contentContainerStyle }: {
  content: string;
  contentContainerStyle?: ViewStyle;
}) {
  const styles = useMemo(() => makeStyles(), []);
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
    >
      <View>
        <MarkdownView content={content} />
      </View>
    </ScrollView>
  );
}

const makeStyles = () => StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
});
