import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, Easing } from 'react-native';
import { Check } from 'lucide-react-native';
import { useToast } from '@/state/useToast';
import { spacing, radius, fonts, Palette, fontSize } from '@/theme';
import { useColors } from '@/theme/useColors';

const DURATION = 1500;

/**
 * Lightweight, dependency-free toast. Animates a small notice in from the bottom,
 * shows a checkmark + message, then auto-dismisses after 1.5s. Rendered
 * absolutely with a high zIndex so it floats above the chat input/keyboard.
 */
export function Toast() {
  const visible = useToast((s) => s.visible);
  const message = useToast((s) => s.message);
  const hide = useToast((s) => s.hide);

  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    Animated.timing(anim, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => { if (finished) hide(); });
    }, DURATION);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [visible, message, anim, hide]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pill,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        },
      ]}
    >
      <Check size={15} color={c.violet} strokeWidth={2.6} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  pill: {
    position: 'absolute',
    bottom: 96,
    alignSelf: 'center',
    zIndex: 1000,
    elevation: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.border,
  },
  text: { color: c.text, fontSize: fontSize.base, fontFamily: fonts.sansSemibold },
});
