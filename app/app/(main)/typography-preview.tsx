import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { MarkdownView } from '@/components/common/Markdown';
import { QuestionCard } from '@/components/chat/QuestionCard';
import { CopyBlock } from '@/components/chat/CopyBlock';
import { Button } from '@/components/ds/Button';
import { PressableScale } from '@/components/ds/PressableScale';
import { canOpenRouteInBuild } from '@/release/routes';
import { Palette, fontSize, radius, spacing, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

export default function TypographyPreview() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const canOpen = canOpenRouteInBuild('typography-preview', __DEV__);

  useEffect(() => {
    if (!canOpen) router.replace('/(main)');
  }, [canOpen]);

  if (!canOpen) return <View style={styles.root} />;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={styles.screenTitle}>Typography Preview</Text>
          <Text style={styles.meta}>Development only / Newsreader + Instrument Sans</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Assistant answer</Text>
          <MarkdownView content={'## A calmer assistant voice\nAether can explain a thought without getting visually loud. The serif should feel light on dark surfaces, with enough air for longer answers and no fake bolding.\n\n- One useful point at a time.\n- Clear rhythm for scanning.\n- Code stays separate.'} />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Long answer</Text>
          <MarkdownView content={'A longer reply should stay readable after several paragraphs. Newsreader Regular carries the assistant voice, while headings use the real Medium variant only when emphasis helps.\n\nThe paragraph measure, line height, and color should make the surface feel calm rather than heavy. Strong text should not become chunky or overly dramatic.'} />
        </View>

        <View style={styles.userBubble}>
          <Text style={styles.userText}>Can you turn this rough idea into a small plan?</Text>
        </View>

        <View style={styles.section}>
          <QuestionCard
            question={{ question: 'Which direction should Aether take this?', options: ['Quiet and practical', 'More exploratory', 'Ask one more question'] }}
            answered={false}
          />
        </View>

        <CopyBlock
          lang="tsx"
          mono
          content={'const tone = \"calm\";\\nreturn <Text style={typography.assistantBody}>Aether</Text>;'}
        />

        <View style={styles.agentCard}>
          <View style={styles.agentHead}>
            <Sparkles size={13} color={c.violet} strokeWidth={2} />
            <Text style={styles.agentTitle}>Actions</Text>
            <Text style={styles.meta}>Balanced</Text>
          </View>
          <Text style={styles.status}>Reading the attached brief</Text>
          <Text style={styles.receipt}>Completed / 3 steps / 1 source / Balanced</Text>
        </View>

        <View style={styles.coreBlock}>
          <Text style={styles.sectionTitle}>Core memory preview</Text>
          <Text style={styles.bodySmall}>Saved Jun 29 / Brand direction</Text>
          <Text style={styles.userText}>Aether should feel calm, private, and more intentional than generic AI chat.</Text>
        </View>

        <View style={styles.settingRow}>
          <View>
            <Text style={styles.sectionTitle}>Research mode</Text>
            <Text style={styles.bodySmall}>Uses public web sources only when you ask.</Text>
          </View>
          <Text style={styles.meta}>Off</Text>
        </View>

        <View style={styles.chips}>
          {['Attach', 'Research', 'Task', 'Voice'].map((chip) => (
            <PressableScale key={chip} style={styles.chip}>
              <Text style={styles.chipText}>{chip}</Text>
            </PressableScale>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Message Aether"
          placeholderTextColor={c.textMuted}
        />

        <Button label="Primary button" onPress={() => undefined} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  content: { padding: spacing.lg, gap: spacing.xl },
  section: { gap: spacing.sm },
  screenTitle: { color: c.text, ...typography.screenTitle },
  sectionTitle: { color: c.text, ...typography.sectionTitle },
  label: { color: c.textMuted, textTransform: 'uppercase', ...typography.metadata },
  meta: { color: c.textMuted, ...typography.metadata },
  bodySmall: { color: c.textMuted, ...typography.bodySmall },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    backgroundColor: c.bgInput,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  userText: { color: c.text, ...typography.input },
  agentCard: {
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  agentHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  agentTitle: { flex: 1, color: c.text, ...typography.label },
  status: { color: c.textMuted, ...typography.status },
  receipt: { color: c.textMuted, ...typography.receipt },
  coreBlock: { gap: spacing.xs },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: c.separator,
    paddingVertical: spacing.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipText: { color: c.text, ...typography.chip },
  input: {
    backgroundColor: c.bgInput,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    color: c.text,
    paddingHorizontal: 15,
    paddingVertical: 10,
    ...typography.input,
  },
});
