import { View, Text, Image, StyleSheet, ImageStyle, ViewStyle } from 'react-native';
import { colors, fonts } from '@/theme';

export const LOGO_PURPLE = require('../../../assets/logo-purple.png');
export const LOGO_WHITE = require('../../../assets/logo-white.png');

export function Logo({ size = 32, tone = 'violet', withWordmark = false, style }: {
  size?: number;
  tone?: 'violet' | 'white';
  withWordmark?: boolean;
  style?: ViewStyle;
}) {
  const img: ImageStyle = { width: size, height: size };
  const src = tone === 'white' ? LOGO_WHITE : LOGO_PURPLE;
  if (!withWordmark) {
    return (
      <View style={[styles.inline, style]}>
        <Image source={src} style={img} resizeMode="contain" />
      </View>
    );
  }
  return (
    <View style={[styles.row, style]}>
      <Image source={src} style={img} resizeMode="contain" />
      <Text
        style={{
          fontFamily: fonts.sansHeavy,
          fontSize: Math.round(size * 0.82),
          letterSpacing: -0.02 * Math.round(size * 0.82),
          color: tone === 'white' ? colors.white : colors.text,
        }}
      >
        Aether
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  inline: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
