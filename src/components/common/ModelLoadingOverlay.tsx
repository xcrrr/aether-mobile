import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, Animated, StyleSheet, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ProgressBar } from './ProgressBar';
import { LOGO_PURPLE } from '@/components/ds/Logo';
import { radius, spacing, fonts, Palette } from '@/theme';
import { useColors } from '@/theme/useColors';

const MESSAGES = [
  'Initializing neural engine…', 'Loading model weights…',
  'Warming up tokenizer…', 'Almost ready…',
];

const RING = 96;
const R = RING / 2 - 2;
const CIRC = 2 * Math.PI * R;

export function ModelLoadingOverlay({ modelName, sizeLabel, sizeGb }: {
  modelName: string; sizeLabel: string; sizeGb: number;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState(0);
  const ref = useRef(0);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1150, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    const tick = setInterval(() => {
      ref.current = Math.min(92, ref.current + (92 - ref.current) * 0.03 + 0.15);
      setPct(Math.round(ref.current));
    }, Math.max(60, (sizeGb * 2600) / 92));
    const cycle = setInterval(() => setMsg((m) => (m + 1) % MESSAGES.length), 1900);
    return () => { loop.stop(); clearInterval(tick); clearInterval(cycle); };
  }, [sizeGb, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <View style={styles.ringBox}>
          <View style={styles.glow} />
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Svg width={RING} height={RING}>
              <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={c.assistantBubble} strokeWidth={3} fill="none" />
              <Circle
                cx={RING / 2} cy={RING / 2} r={R}
                stroke={c.violet} strokeWidth={3} fill="none"
                strokeDasharray={`${CIRC * 0.7} ${CIRC}`} strokeLinecap="round"
              />
            </Svg>
          </Animated.View>
          <Image source={LOGO_PURPLE} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={styles.model} numberOfLines={1}>{modelName}</Text>
          <Text style={styles.pct}>{pct}%</Text>
        </View>

        <View style={{ width: '100%' }}>
          <ProgressBar percent={pct} height={5} />
        </View>
        <Text style={styles.msg}>{MESSAGES[msg]}</Text>
        <Text style={styles.size}>{sizeLabel}</Text>
      </View>
    </View>
  );
}
const makeStyles = (c: Palette) => StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: c.scrim, justifyContent: 'center', alignItems: 'center', zIndex: 50 },
  card: { width: '82%', maxWidth: 300, backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: 28, paddingTop: 34, paddingBottom: 26, alignItems: 'center', gap: 20 },
  ringBox: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 78, height: 78, borderRadius: 39, backgroundColor: c.violetDim },
  logo: { position: 'absolute', width: 38, height: 38 },
  model: { color: c.text, fontSize: 15, fontFamily: fonts.sansBold },
  pct: { color: c.violet, fontSize: 26, fontFamily: fonts.sansHeavy, letterSpacing: -0.3 },
  msg: { color: c.textMuted, fontSize: 13, fontFamily: fonts.sans, minHeight: 18, textAlign: 'center' },
  size: { color: c.textMuted, fontSize: 12, fontFamily: fonts.sans, marginTop: -spacing.md },
});
