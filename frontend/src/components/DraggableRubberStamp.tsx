import { type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { RubberStamp, type StampPalette } from "@/src/components/RubberStamp";
import type { DesignPreset } from "@/src/lib/theme-presets";
import type { StampVariant } from "@/src/components/RubberStamp.types";

const STAMP_DROP_Y = -52;

type DraggableRubberStampProps = {
  variant: StampVariant;
  onStamp: () => void;
  palette?: StampPalette;
  preset?: DesignPreset;
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
};

export function DraggableRubberStamp({
  variant,
  onStamp,
  palette,
  preset = "legacy",
  disabled,
  testID,
  style,
}: DraggableRubberStampProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const dragScale = useSharedValue(1);
  const dragZ = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onBegin(() => {
      dragZ.value = 1;
      dragScale.value = 1.03;
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd(() => {
      const dropped = translateY.value < STAMP_DROP_Y;
      if (dropped && !disabled) {
        runOnJS(onStamp)();
      }
      translateX.value = withSpring(0, { damping: 22, stiffness: 200 });
      translateY.value = withSpring(0, { damping: 22, stiffness: 200 });
      dragScale.value = withSpring(1, { damping: 22, stiffness: 200 });
      dragZ.value = 0;
    })
    .onFinalize(() => {
      dragScale.value = withSpring(1, { damping: 22, stiffness: 200 });
      dragZ.value = 0;
    });

  const stampStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: dragScale.value },
    ],
    zIndex: dragZ.value ? 50 : 1,
    elevation: dragZ.value ? 8 : 1,
    opacity: disabled ? 0.45 : 1,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[stampStyle, style]} testID={testID}>
        <RubberStamp variant={variant} size="dock" palette={palette} preset={preset} showHandle />
      </Animated.View>
    </GestureDetector>
  );
}
