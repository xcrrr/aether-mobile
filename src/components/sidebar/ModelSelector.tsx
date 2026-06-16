import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MODELS } from '@/models/registry';
import { useModelStore } from '@/state/useModelStore';
import { colors, radius, spacing } from '@/theme';

export function ModelSelector() {
  const { installed, activeModelId, setActive } = useModelStore();
  return (
    <View style={styles.box}>
      <Text style={styles.label}>Model</Text>
      {MODELS.map((m) => {
        const ready = installed[m.id];
        const active = activeModelId === m.id;
        return (
          <Pressable
            key={m.id}
            disabled={!ready}
            onPress={() => setActive(m.id)}
            style={[styles.row, active && styles.active, !ready && styles.disabled]}
          >
            <Text style={[styles.name, { color: active ? colors.purple : colors.text }]}>{m.name}</Text>
            <Text style={styles.meta}>{ready ? (active ? 'Active' : 'Tap to use') : 'Not installed'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  box: { marginTop: spacing.md },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm, textTransform: 'uppercase' },
  row: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  active: { borderColor: colors.purple },
  disabled: { opacity: 0.45 },
  name: { fontSize: 14, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
