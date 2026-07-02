import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { PressableScale } from '@/components/ds/PressableScale';
import { MODES, getModelById } from '@/models/registry';
import { spacing, radius, fonts, Palette, fontSize, shadow, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

export function ModeSelector({ mode, installed, onSelect }: {
  mode: 'fast' | 'thinking';
  installed: Record<string, boolean>;
  onSelect: (modeId: 'fast' | 'thinking') => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);
  const current = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <View>
      <PressableScale style={styles.trigger} onPress={() => setOpen(true)} scaleTo={0.94}>
        <View style={styles.dot} />
        <Text style={styles.triggerLabel}>{current.label}</Text>
        <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
          <Path d="M2 3.5L5 6.5L8 3.5" stroke={c.textMuted} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </PressableScale>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            {MODES.map((m) => {
              const sel = m.id === mode;
              const model = getModelById(m.modelId);
              const ready = !!installed[m.modelId];
              return (
                <PressableScale
                  key={m.id}
                  style={[styles.item, sel && styles.itemSelected]}
                  onPress={() => { setOpen(false); onSelect(m.id); }}
                  scaleTo={0.98}
                >
                  <View style={[styles.itemDot, { backgroundColor: sel ? c.violet : c.border }]} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.itemHead}>
                      <Text style={[styles.itemLabel, sel && styles.itemLabelSelected]}>{m.label}</Text>
                      <Text style={styles.itemMeta}>{ready ? model?.sizeLabel : 'Not installed'}</Text>
                    </View>
                    <Text style={styles.itemModel}>{model?.name}</Text>
                    <Text style={styles.itemDesc}>{m.desc}</Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 2, paddingHorizontal: spacing.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.textMuted },
  triggerLabel: { fontFamily: fonts.sansSemibold, fontSize: fontSize.sm, color: c.textMuted },
  backdrop: { flex: 1, alignItems: 'center', paddingTop: 96, backgroundColor: 'transparent' },
  menu: {
    width: 248, backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1,
    borderRadius: radius.md, overflow: 'hidden',
    ...shadow.lg,
  },
  item: { flexDirection: 'row', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: c.separator },
  itemSelected: { backgroundColor: c.bgInput },
  itemDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 5 },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemLabel: { color: c.text, ...typography.label },
  itemLabelSelected: { color: c.text },
  itemMeta: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: c.textMuted },
  itemModel: { fontFamily: fonts.sans, fontSize: fontSize.sm, color: c.textMuted, marginTop: 2 },
  itemDesc: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: c.textMuted, marginTop: 3, opacity: 0.8 },
});
