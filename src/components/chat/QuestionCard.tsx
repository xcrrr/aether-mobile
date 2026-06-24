import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AetherQuestion } from '@/llm/messageParse';
import { colors, radius, spacing, fonts } from '@/theme';

/**
 * Claude-style elicitation card: a prominent question with tappable option
 * pills. Tapping an option sends it as the user's next message. Once the
 * question has been answered (another message follows it), the card locks and
 * shows the chosen option highlighted.
 */
export function QuestionCard({ question, answered, onSelect }: {
  question: AetherQuestion;
  answered: boolean;
  onSelect?: (option: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const locked = answered || picked !== null;

  const choose = (option: string) => {
    if (locked) return;
    setPicked(option);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect?.(option);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.question}>{question.question}</Text>
      <View style={styles.options}>
        {question.options.map((opt) => {
          const isPicked = picked === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => choose(opt)}
              disabled={locked}
              style={[
                styles.pill,
                isPicked && styles.pillPicked,
                locked && !isPicked && styles.pillMuted,
              ]}
            >
              <Text style={[styles.pillLabel, isPicked && styles.pillLabelPicked]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: 2,
  },
  question: { color: colors.text, fontSize: 16, lineHeight: 23, fontFamily: fonts.sansSemibold, marginBottom: spacing.md },
  options: { gap: spacing.sm },
  pill: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.assistantBubble,
    borderRadius: radius.full,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  pillPicked: { backgroundColor: colors.violet, borderColor: colors.violet },
  pillMuted: { opacity: 0.4 },
  pillLabel: { color: colors.text, fontSize: 14, fontFamily: fonts.sansMedium },
  pillLabelPicked: { color: colors.white },
});
