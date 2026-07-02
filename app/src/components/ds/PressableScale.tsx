import { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle, GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { motion } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Drop-in Pressable that springs slightly on touch (scale + fade) and can fire a
 * light haptic. This is the shared "alive" feel for every tappable surface — use it
 * instead of a bare Pressable for buttons, pills, rows, and icon controls.
 *
 * `style` is a static ViewStyle (no `({ pressed }) => ...` function — the animation
 * replaces the need for it). All other Pressable props pass straight through.
 */
export function PressableScale({
  style,
  scaleTo = motion.pressScale,
  fadeTo = motion.pressFade,
  haptic = false,
  disabled,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  fadeTo?: number;
  haptic?: boolean;
  children?: React.ReactNode;
}) {
  const v = useRef(new Animated.Value(0)).current; // 0 = rest, 1 = pressed
  const to = (value: number) =>
    Animated.timing(v, { toValue: value, duration: motion.durFast, useNativeDriver: true }).start();

  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [1, fadeTo] });

  const handleIn = (e: GestureResponderEvent) => {
    if (!disabled) {
      to(1);
      if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPressIn?.(e);
  };
  const handleOut = (e: GestureResponderEvent) => {
    to(0);
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={handleIn}
      onPressOut={handleOut}
      style={[style, { transform: [{ scale }], opacity: disabled ? undefined : opacity }]}
    >
      {children}
    </AnimatedPressable>
  );
}
