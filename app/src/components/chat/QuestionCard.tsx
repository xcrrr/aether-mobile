import { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PressableScale } from '@/components/ds/PressableScale';
import { AetherQuestion } from '@/llm/messageParse';
import { radius, spacing, Palette, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

/**
 * Claude-style elicitation card: a prominent question with tappable options.
 * Tapping an option sends it as the user's next message. Once the question has
 * been answered — by tap (persisted as `picked`) or by any later message — the
 * card locks, keeping the chosen option highlighted.
 */
export function QuestionCard({ question, answered, picked = null, onSelect }: {
  question: AetherQuestion;
  answered: boolean;
  /** The persisted selection, if the user answered by tapping an option. */
  picked?: string | null;
  onSelect?: (option: string) => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [localPick, setLocalPick] = useState<string | null>(null);
  const firing = useRef(false);
  const chosen = picked ?? localPick;
  const locked = answered || chosen !== null;

  const choose = (option: string) => {
    if (locked || firing.current) return;
    firing.current = true;
    setLocalPick(option);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect?.(option);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.question}>{question.question}</Text>
      <View style={styles.options}>
        {question.options.map((opt) => {
          const isPicked = chosen === opt;
          return (
            <PressableScale
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
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  card: {
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.xs,
  },
  question: {
    color: c.text,
    ...typography.assistantBodyCompact,
    marginBottom: spacing.md,
  },
  options: { gap: spacing.sm },
  pill: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.assistantBubble,
    borderRadius: radius.sm,
    paddingVertical: spacing.md - 1,
    paddingHorizontal: spacing.lg,
  },
  pillPicked: { backgroundColor: c.violetDim, borderColor: c.violetDim },
  pillMuted: { opacity: 0.4 },
  pillLabel: { color: c.text, ...typography.label },
  pillLabelPicked: { color: c.violet },
});
