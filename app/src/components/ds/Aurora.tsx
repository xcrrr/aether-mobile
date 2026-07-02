import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Easing, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Ellipse, Path } from 'react-native-svg';
import { useColors } from '@/theme/useColors';

function AuroraLayer({ width, height, from, to, duration, delay = 0, opacity, color, accent, active }: {
  width: number; height: number;
  from: { x: number; y: number; s: number; r: number };
  to: { x: number; y: number; s: number; r: number };
  duration: number; delay?: number; opacity: number; color: string; accent: string; active: boolean;
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
  }, [active, delay, duration, t]);

  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] });
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] });
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [from.s, to.s] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: [`${from.r}deg`, `${to.r}deg`] });
  const fillId = `aether-aurora-fill-${width}-${Math.round(from.x)}`;
  const strokeId = `aether-aurora-stroke-${width}-${Math.round(to.y)}`;

  return (
    <Animated.View
      style={[
        styles.layer,
        { width, height, transform: [{ translateX }, { translateY }, { rotate }, { scale }] },
      ]}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <RadialGradient id={fillId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={accent} stopOpacity={String(opacity * 0.95)} />
            <Stop offset="38%" stopColor={color} stopOpacity={String(opacity * 0.46)} />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id={strokeId} x1="0%" y1="50%" x2="100%" y2="50%">
            <Stop offset="0%" stopColor={accent} stopOpacity="0" />
            <Stop offset="50%" stopColor={accent} stopOpacity={String(opacity * 0.36)} />
            <Stop offset="100%" stopColor={accent} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill={`url(#${fillId})`} />
        <Path
          d={`M ${width * 0.1} ${height * 0.55} C ${width * 0.34} ${height * 0.25}, ${width * 0.66} ${height * 0.74}, ${width * 0.9} ${height * 0.46}`}
          fill="none"
          stroke={`url(#${strokeId})`}
          strokeLinecap="round"
          strokeWidth={2}
        />
      </Svg>
    </Animated.View>
  );
}

function BreathingSheen({ active, intensity }: { active: boolean; intensity: number }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 3400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 3400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, t]);

  const opacity = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.05, 0.2 * intensity, 0.05] });
  const scaleX = t.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] });

  return (
    <Animated.View style={[styles.sheen, { opacity, transform: [{ translateX: -140 }, { scaleX }] }]}>
      <Svg width={280} height={2} viewBox="0 0 280 2">
        <Defs>
          <LinearGradient id="aether-aurora-sheen" x1="0%" y1="50%" x2="100%" y2="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.62" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="280" height="2" rx="1" fill="url(#aether-aurora-sheen)" />
      </Svg>
    </Animated.View>
  );
}

export function Aurora({ active = true, intensity = 1 }: { active?: boolean; intensity?: number }) {
  const colors = useColors();
  const fade = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: active ? 1 : 0,
      duration: active ? 900 : 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, fade]);

  const base = 0.28 * intensity;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, opacity: Math.min(1, 0.94 * intensity) }]} />
      <AuroraLayer
        width={720}
        height={270}
        color={colors.aurora1}
        accent="#D8CCFF"
        from={{ x: -230, y: 44, s: 0.9, r: -17 }}
        to={{ x: -70, y: 8, s: 1.06, r: -10 }}
        duration={15000}
        opacity={base}
        active={active}
      />
      <AuroraLayer
        width={620}
        height={240}
        color={colors.aurora2}
        accent="#BFA7FF"
        from={{ x: 96, y: 190, s: 0.84, r: 15 }}
        to={{ x: -70, y: 132, s: 1, r: 8 }}
        duration={18000}
        delay={360}
        opacity={base * 0.62}
        active={active}
      />
      <AuroraLayer
        width={560}
        height={300}
        color={colors.aurora3}
        accent="#F4EEFF"
        from={{ x: -130, y: -118, s: 0.96, r: 28 }}
        to={{ x: 2, y: -54, s: 0.86, r: 36 }}
        duration={20000}
        delay={760}
        opacity={base * 0.74}
        active={active}
      />
      <BreathingSheen active={active} intensity={intensity} />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="aether-aurora-vignette" cx="50%" cy="42%" r="72%">
            <Stop offset="38%" stopColor={colors.bg} stopOpacity="0" />
            <Stop offset="100%" stopColor={colors.bg} stopOpacity="0.78" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#aether-aurora-vignette)" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  layer: { position: 'absolute' },
  sheen: { position: 'absolute', left: '50%', top: '49%' },
});
