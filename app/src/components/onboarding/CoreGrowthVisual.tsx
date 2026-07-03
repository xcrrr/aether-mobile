import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { motion, radius } from '@/theme';
import { useColors } from '@/theme/useColors';

const BASE = 200;
const CENTER = BASE / 2;
const CENTER_BOX = 44;
const SPOKE_START = 14;
const SPOKE_END_GAP = 4;
const NODE_STAGGER = motion.durBase + motion.durFast;
const NODE_DUR = motion.durBase * 2;

type NodeSpec = { x: number; y: number; r: number; tone: 'violet' | 'muted'; peak: number };

const NODES: NodeSpec[] = [
  { x: 150, y: 58, r: 4, tone: 'violet', peak: 0.9 },
  { x: 56, y: 70, r: 3, tone: 'muted', peak: 0.6 },
  { x: 158, y: 118, r: 3.5, tone: 'violet', peak: 0.7 },
  { x: 76, y: 150, r: 4.5, tone: 'violet', peak: 0.85 },
  { x: 118, y: 166, r: 3, tone: 'muted', peak: 0.55 },
  { x: 40, y: 112, r: 3.5, tone: 'violet', peak: 0.75 },
];

const SPOKES = NODES.map((n) => {
  const dx = n.x - CENTER;
  const dy = n.y - CENTER;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: CENTER + ux * SPOKE_START,
    y1: CENTER + uy * SPOKE_START,
    x2: n.x - ux * (n.r + SPOKE_END_GAP),
    y2: n.y - uy * (n.r + SPOKE_END_GAP),
  };
});

export function CoreGrowthVisual({ active = true, size = 200 }: { active?: boolean; size?: number }): JSX.Element {
  const c = useColors();
  const [reduceMotion, setReduceMotion] = useState(false);
  const nodeAnims = useRef(NODES.map(() => new Animated.Value(0))).current;
  const breath = useRef(new Animated.Value(0)).current;
  const k = size / BASE;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      nodeAnims.forEach((v) => v.setValue(1));
      breath.setValue(1);
      return undefined;
    }
    if (!active) {
      nodeAnims.forEach((v) => v.setValue(0));
      breath.setValue(0);
      return undefined;
    }

    nodeAnims.forEach((v) => v.setValue(0));
    breath.setValue(0);
    let settle: Animated.CompositeAnimation | null = null;
    const grow = Animated.stagger(
      NODE_STAGGER,
      nodeAnims.map((v) =>
        Animated.timing(v, {
          toValue: 1,
          duration: NODE_DUR,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    );
    grow.start(({ finished }) => {
      if (!finished) return;
      settle = Animated.loop(
        Animated.sequence([
          Animated.timing(breath, {
            toValue: 1,
            duration: motion.durSlow,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(breath, {
            toValue: 0,
            duration: motion.durSlow,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      settle.start();
    });

    return () => {
      grow.stop();
      settle?.stop();
    };
  }, [active, reduceMotion, breath, nodeAnims]);

  const centerOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.78, 0.96] });
  const centerScale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1.02] });

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {SPOKES.map((s, i) => (
        <Animated.View
          key={`spoke-${i}`}
          style={[
            StyleSheet.absoluteFill,
            { opacity: nodeAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }) },
          ]}
        >
          <Svg width={size} height={size} viewBox={`0 0 ${BASE} ${BASE}`}>
            <Line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={c.border} strokeWidth={1} strokeLinecap="round" />
          </Svg>
        </Animated.View>
      ))}

      {NODES.map((n, i) => (
        <Animated.View
          key={`node-${i}`}
          style={{
            position: 'absolute',
            left: (n.x - n.r) * k,
            top: (n.y - n.r) * k,
            width: n.r * 2 * k,
            height: n.r * 2 * k,
            borderRadius: radius.full,
            backgroundColor: n.tone === 'violet' ? c.violet : c.textMuted,
            opacity: nodeAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, n.peak] }),
            transform: [{ scale: nodeAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          }}
        />
      ))}

      <Animated.View
        style={{
          position: 'absolute',
          left: (CENTER - CENTER_BOX / 2) * k,
          top: (CENTER - CENTER_BOX / 2) * k,
          width: CENTER_BOX * k,
          height: CENTER_BOX * k,
          opacity: centerOpacity,
          transform: [{ scale: centerScale }],
        }}
      >
        <Svg width={CENTER_BOX * k} height={CENTER_BOX * k} viewBox={`0 0 ${CENTER_BOX} ${CENTER_BOX}`}>
          <Circle cx={CENTER_BOX / 2} cy={CENTER_BOX / 2} r={21} fill={c.violetDim} />
          <Circle cx={CENTER_BOX / 2} cy={CENTER_BOX / 2} r={7.5} fill="none" stroke={c.violet} strokeWidth={1.5} />
          <Circle cx={CENTER_BOX / 2} cy={CENTER_BOX / 2} r={2.75} fill={c.violet} />
        </Svg>
      </Animated.View>
    </View>
  );
}
