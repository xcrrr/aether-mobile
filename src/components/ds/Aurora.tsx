import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Easing, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Circle } from 'react-native-svg';
import { useColors } from '@/theme/useColors';

/**
 * Living gradient backdrop — large soft violet blobs that drift and scale over
 * pure black, with a vignette to keep the edges premium. An RN approximation of
 * the web design's blurred aurora (soft radial gradients stand in for CSS blur).
 *
 * `active` fades the whole layer in/out smoothly (used to surface the aurora
 * only while Aether is thinking/typing/researching). When inactive the blob
 * loops are paused so it costs nothing at rest. `intensity` scales blob opacity
 * for surfaces where the aurora should sit further back (e.g. the chat).
 */
function Blob({ size, color, from, to, duration, delay = 0, opacity = 0.6, active }: {
  size: number; color: string;
  from: { x: number; y: number; s: number };
  to: { x: number; y: number; s: number };
  duration: number; delay?: number; opacity?: number; active: boolean;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration, delay, active]);
  const tx = t.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] });
  const ty = t.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] });
  const sc = t.interpolate({ inputRange: [0, 1], outputRange: [from.s, to.s] });
  const id = `blob${size}${Math.round(from.x)}`;
  return (
    <Animated.View
      style={{ position: 'absolute', transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }] }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={String(opacity)} />
            <Stop offset="68%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

export function Aurora({ active = true, intensity = 1 }: { active?: boolean; intensity?: number }) {
  const colors = useColors();
  // Whole-layer fade — smooth appear while thinking, smooth dissolve at rest.
  const fade = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: active ? 1 : 0,
      duration: active ? 900 : 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fade, active]);

  const blobOpacity = 0.6 * intensity;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, opacity: intensity < 1 ? intensity : 1 }]} />
      <Blob size={380} color={colors.aurora1} from={{ x: -60, y: -40, s: 1 }} to={{ x: 80, y: 30, s: 1.3 }} duration={11000} opacity={blobOpacity} active={active} />
      <Blob size={340} color={colors.aurora2} from={{ x: 180, y: 80, s: 1.1 }} to={{ x: -40, y: -60, s: 0.85 }} duration={13000} delay={400} opacity={blobOpacity} active={active} />
      <Blob size={320} color={colors.aurora3} from={{ x: 20, y: 320, s: 0.9 }} to={{ x: -80, y: 120, s: 1.3 }} duration={12000} delay={800} opacity={blobOpacity} active={active} />
      {/* vignette */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="aether-vignette" cx="50%" cy="40%" r="70%">
            <Stop offset="38%" stopColor={colors.bg} stopOpacity="0" />
            <Stop offset="100%" stopColor={colors.bg} stopOpacity="0.6" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#aether-vignette)" />
      </Svg>
    </Animated.View>
  );
}
