import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { ProgressBar } from './ProgressBar';

const MESSAGES = [
  'Initializing neural engine...', 'Loading model weights...',
  'Mapping memory layers...', 'Warming up inference...', 'Almost ready...',
];

export function ModelLoadingOverlay({ modelName, sizeLabel, sizeGb }: {
  modelName: string; sizeLabel: string; sizeGb: number;
}) {
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState(0);
  const ref = useRef(0);

  useEffect(() => {
    const tick = setInterval(() => {
      ref.current = Math.min(92, ref.current + (92 - ref.current) * 0.03 + 0.15);
      setPct(Math.round(ref.current));
    }, Math.max(60, (sizeGb * 2600) / 92));
    const cycle = setInterval(() => setMsg((m) => (m + 1) % MESSAGES.length), 1900);
    return () => { clearInterval(tick); clearInterval(cycle); };
  }, [sizeGb]);

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.app}>Aether</Text>
        <Text style={styles.model} numberOfLines={1}>{modelName}</Text>
        <Text style={styles.size}>{sizeLabel}</Text>
        <ProgressBar percent={pct} />
        <Text style={styles.pct}>{pct}%</Text>
        <Text style={styles.msg}>{MESSAGES[msg]}</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0B0B0FF5', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  card: { width: '78%', maxWidth: 320, backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: radius.xl, padding: spacing.xl },
  app: { color: colors.text, fontWeight: '700', textAlign: 'center', marginBottom: spacing.md },
  model: { color: colors.text, fontWeight: '700', fontSize: 16, textAlign: 'center' },
  size: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: spacing.lg },
  pct: { color: colors.purple, fontWeight: '700', textAlign: 'right', marginTop: spacing.xs, marginBottom: spacing.md },
  msg: { color: colors.textMuted, fontStyle: 'italic', fontSize: 12, textAlign: 'center' },
});
