import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '@/theme';

/**
 * A thin violet gradient that sweeps left→right while the mic is listening — a
 * lively, unmistakable "I'm hearing you" signal above the composer.
 *
 * Implementation: a double-width gradient with a repeating bright band, slid by
 * exactly one container width so the loop is seamless (the pattern repeats every
 * `w`). Driven on the native thread (translateX).
 */
export function ListeningWave() {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!w) return;
    x.setValue(0);
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [w, x]);

  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-w, 0] });

  return (
    <View style={styles.track} onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      {w > 0 && (
        <Animated.View style={{ width: w * 2, transform: [{ translateX }] }}>
          <Svg width={w * 2} height={HEIGHT}>
            <Defs>
              <LinearGradient id="listeningWave" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.violet} stopOpacity="0.08" />
                <Stop offset="0.25" stopColor={colors.violet} stopOpacity="1" />
                <Stop offset="0.5" stopColor={colors.violet} stopOpacity="0.08" />
                <Stop offset="0.75" stopColor={colors.violet} stopOpacity="1" />
                <Stop offset="1" stopColor={colors.violet} stopOpacity="0.08" />
              </LinearGradient>
            </Defs>
            <Rect width={w * 2} height={HEIGHT} fill="url(#listeningWave)" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const HEIGHT = 4;
const styles = StyleSheet.create({
  track: { height: HEIGHT, width: '100%', overflow: 'hidden', borderRadius: HEIGHT, marginBottom: 8 },
});
