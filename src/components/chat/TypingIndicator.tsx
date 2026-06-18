import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { colors, radius } from '@/theme';

function Dot({ delay }: { delay: number }) {
  const v = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 360, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.25, duration: 480, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(360),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return <Animated.View style={[styles.dot, { opacity: v }]} />;
}

export function TypingIndicator() {
  return (
    <View style={styles.pill}>
      <Dot delay={0} />
      <Dot delay={200} />
      <Dot delay={400} />
    </View>
  );
}
const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.assistantBubble, borderRadius: radius.lg, alignSelf: 'flex-start' },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.textMuted },
});
