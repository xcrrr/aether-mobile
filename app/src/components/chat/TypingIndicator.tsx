import { useEffect, useMemo, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { Palette, radius } from '@/theme';
import { useColors } from '@/theme/useColors';

function Dot({ delay, active }: { delay: number; active?: boolean }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 420, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(260),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);

  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.28, 1] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.16] });

  return <Animated.View style={[styles.dot, active && styles.dotActive, { opacity, transform: [{ scale }] }]} />;
}

export function TypingIndicator() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.pill}>
      <Dot delay={0} />
      <Dot delay={180} active />
      <Dot delay={360} />
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 2,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: c.textMuted,
  },
  dotActive: {
    backgroundColor: c.violet,
  },
});
