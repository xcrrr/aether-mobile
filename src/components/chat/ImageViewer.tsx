import { Modal, View, Pressable, Share, StyleSheet, Dimensions } from 'react-native';
import { X, Share2 } from 'lucide-react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme';

const { width, height } = Dimensions.get('window');

/** Fullscreen, pinch-zoomable image viewer with share + close affordances. */
export function ImageViewer({ uri, visible, onClose }: {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const reset = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedX.value = 0;
    savedY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 5));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      translateX.value = savedX.value + e.translationX;
      translateY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const close = () => { reset(); onClose(); };

  const share = async () => {
    if (!uri) return;
    try {
      await Share.share({ url: uri, message: uri });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  };

  return (
    <Modal visible={visible && !!uri} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.container}>
        {uri && (
          <GestureDetector gesture={composed}>
            <Animated.Image source={{ uri }} style={[styles.image, animatedStyle]} resizeMode="contain" />
          </GestureDetector>
        )}
        <Pressable style={[styles.btn, styles.share]} onPress={share} hitSlop={10}>
          <Share2 size={22} color={colors.white} />
        </Pressable>
        <Pressable style={[styles.btn, styles.close]} onPress={close} hitSlop={10}>
          <X size={24} color={colors.white} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  image: { width, height },
  btn: { position: 'absolute', top: 48, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  share: { left: 16 },
  close: { right: 16 },
});
