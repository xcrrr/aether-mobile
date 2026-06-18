import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Easing, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Circle } from 'react-native-svg';
import { colors } from '@/theme';

/**
 * Living gradient backdrop — large soft violet blobs that drift and scale over
 * pure black, with a vignette to keep the edges premium. An RN approximation of
 * the web design's blurred aurora (soft radial gradients stand in for CSS blur).
 */
function Blob({ size, color, from, to, duration, delay = 0 }: {
  size: number; color: string;
  from: { x: number; y: number; s: number };
  to: { x: number; y: number; s: number };
  duration: number; delay?: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration, delay]);
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
            <Stop offset="0%" stopColor={color} stopOpacity="0.6" />
            <Stop offset="68%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

export function Aurora() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.black }]} />
      <Blob size={380} color="#7C3AED" from={{ x: -60, y: -40, s: 1 }} to={{ x: 80, y: 30, s: 1.3 }} duration={11000} />
      <Blob size={340} color="#5B21B6" from={{ x: 180, y: 80, s: 1.1 }} to={{ x: -40, y: -60, s: 0.85 }} duration={13000} delay={400} />
      <Blob size={320} color="#9333EA" from={{ x: 20, y: 320, s: 0.9 }} to={{ x: -80, y: 120, s: 1.3 }} duration={12000} delay={800} />
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
    </View>
  );
}
