import { useCallback, useEffect, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 850;

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
};

/** Modal shell with backdrop tap + swipe-down — no inner sheet styling. */
export default function DismissibleBottomSheet({ visible, onClose, children, testID }: Props) {
  const translateY = useSharedValue(0);
  const dragOffset = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = 0;
      dragOffset.value = 0;
    }
  }, [visible, translateY, dragOffset]);

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  const pan = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetX([-28, 28])
    .onBegin(() => {
      dragOffset.value = translateY.value;
    })
    .onUpdate((e) => {
      translateY.value = Math.max(0, dragOffset.value + e.translationY);
    })
    .onEnd((e) => {
      const shouldDismiss =
        translateY.value > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        runOnJS(close)();
        return;
      }
      translateY.value = withSpring(0, { damping: 22, stiffness: 280 });
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop} testID={testID}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
        <GestureDetector gesture={pan}>
          <Animated.View style={sheetStyle}>{children}</Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
});
