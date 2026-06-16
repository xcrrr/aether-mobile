import { useState } from 'react';
import { Text, TextInput, StyleSheet, View } from 'react-native';
import { Screen } from '@/components/common/Screen';
import { Button } from '@/components/common/Button';
import { colors, radius, spacing } from '@/theme';

export function OnboardingStep({ title, subtitle, placeholder, initial, onNext, cta = 'Continue' }: {
  title: string; subtitle: string; placeholder: string; initial?: string;
  onNext: (value: string) => void; cta?: string;
}) {
  const [value, setValue] = useState(initial ?? '');
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={setValue}
          autoFocus
        />
      </View>
      <Button label={cta} onPress={() => onNext(value.trim())} disabled={value.trim().length === 0} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.sm },
  subtitle: { color: colors.textMuted, fontSize: 15, marginBottom: spacing.xl },
  input: { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, padding: spacing.lg, fontSize: 16 },
});
