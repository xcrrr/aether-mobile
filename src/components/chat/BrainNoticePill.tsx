import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, Easing } from 'react-native';
import { Brain, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { useBrainNotice } from '@/state/useBrainNotice';
import { radius, fonts, Palette } from '@/theme';
import { useColors } from '@/theme/useColors';

const VISIBLE_MS = 6500;

/**
 * Floating, tappable pill shown after a reply when the Second Brain just learned
 * something: "N saved to your Second Brain ›". Tapping deep-links into the 3D
 * graph, where the new facts glow. Auto-dismisses after a few seconds. Re-fires
 * its entrance animation on every new save (tracked via `nonce`).
 */
export function BrainNoticePill() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const count = useBrainNotice((s) => s.count);
  const nonce = useBrainNotice((s) => s.nonce);
  const dismiss = useBrainNotice((s) => s.dismiss);

  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (count <= 0) return;
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 80 }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }).start(({ finished }) => { if (finished) dismiss(); });
    }, VISIBLE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [count, nonce, anim, dismiss]);

  if (count <= 0) return null;

  const open = () => {
    if (timer.current) clearTimeout(timer.current);
    dismiss();
    router.push('/(main)/second-brain');
  };

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
    >
      <Pressable style={styles.pill} onPress={open} hitSlop={6}>
        <Brain size={16} color={c.violet} strokeWidth={2.2} />
        <Text style={styles.text}>
          {count} {count === 1 ? 'memory' : 'memories'} saved to your Second Brain
        </Text>
        <ChevronRight size={16} color={c.violet} strokeWidth={2.4} />
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.violetDim,
    borderColor: c.violet, borderWidth: 1,
    borderRadius: radius.full, paddingVertical: 9, paddingHorizontal: 14,
  },
  text: { color: c.text, fontSize: 13, fontFamily: fonts.sansSemibold },
});
