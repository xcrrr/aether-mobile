import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Logo } from '@/components/ds/Logo';
import { fonts, fontSize, motion, Palette, radius, spacing } from '@/theme';
import { useColors } from '@/theme/useColors';

const DEFAULT_PRIMARY_TEXT = 'Preparing locally';
const DEFAULT_SECONDARY_TEXT = 'Your model stays on this device';
const MARK_SIZE = spacing.xxl + spacing.xs;
const LINE_MAX_WIDTH = spacing.xxl * 7;
const LINE_MIN_WIDTH = spacing.xxl * 4;
const LINE_SEGMENT_WIDTH = spacing.xxl * 2;

type ModelLoadingOverlayProps = {
  modelName: string;
  sizeLabel: string;
  sizeGb: number;
  complete?: boolean;
  primaryText?: string;
  secondaryText?: string;
};

export function ModelLoadingOverlay({
  complete = false,
  primaryText = DEFAULT_PRIMARY_TEXT,
  secondaryText = DEFAULT_SECONDARY_TEXT,
}: ModelLoadingOverlayProps) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const availableLineWidth = Math.max(LINE_MIN_WIDTH, width - spacing.xxl * 2);
  const loadingLineWidth = Math.min(LINE_MAX_WIDTH, availableLineWidth);
  const segmentWidth = Math.min(LINE_SEGMENT_WIDTH, Math.round(loadingLineWidth / 3));
  const styles = useMemo(() => makeStyles(c, loadingLineWidth, segmentWidth), [c, loadingLineWidth, segmentWidth]);

  const markBreath = useRef(new Animated.Value(0)).current;
  const lineTravel = useRef(new Animated.Value(0)).current;
  const dissolve = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      markBreath.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(markBreath, {
          toValue: 1,
          duration: motion.durSlow,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(markBreath, {
          toValue: 0,
          duration: motion.durSlow,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [markBreath, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      lineTravel.setValue(0.5);
      return undefined;
    }

    lineTravel.setValue(0);
    const loop = Animated.loop(
      Animated.timing(lineTravel, {
        toValue: 1,
        duration: motion.durSlow + motion.durBase,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [lineTravel, reduceMotion]);

  useEffect(() => {
    Animated.timing(dissolve, {
      toValue: complete ? 0 : 1,
      duration: complete ? motion.durBase * 2 : motion.durBase,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [complete, dissolve]);

  const markScale = markBreath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.985, 1],
  });
  const markOpacity = markBreath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.78, 0.96],
  });
  const lineTranslateX = lineTravel.interpolate({
    inputRange: [0, 1],
    outputRange: [-segmentWidth, loadingLineWidth],
  });

  return (
    <Animated.View
      accessibilityLabel={`${primaryText}. ${secondaryText}.`}
      accessibilityRole="progressbar"
      style={[styles.backdrop, { opacity: dissolve }]}
      pointerEvents="none"
    >
      <View style={styles.content}>
        <Animated.View style={[styles.mark, { opacity: markOpacity, transform: [{ scale: markScale }] }]}>
          <Logo size={MARK_SIZE} tone="violet" />
        </Animated.View>

        <Text style={styles.primary}>{primaryText}</Text>

        <View style={styles.loadingTrack}>
          <Animated.View style={[styles.loadingSegment, { transform: [{ translateX: lineTranslateX }] }]} />
        </View>

        <Text style={styles.secondary}>{secondaryText}</Text>
      </View>
    </Animated.View>
  );
}

const makeStyles = (c: Palette, loadingLineWidth: number, segmentWidth: number) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.bg,
    zIndex: 50,
  },
  content: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  mark: {
    marginBottom: spacing.xl,
  },
  primary: {
    color: c.text,
    fontFamily: fonts.sansMedium,
    fontSize: fontSize.lg,
    lineHeight: 24,
    textAlign: 'center',
  },
  loadingTrack: {
    width: loadingLineWidth,
    height: 2,
    borderRadius: radius.full,
    backgroundColor: c.violetDim,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  loadingSegment: {
    width: segmentWidth,
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: c.violet,
    opacity: 0.5,
  },
  secondary: {
    color: c.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSize.sm2,
    lineHeight: 19,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
