import { type ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

/** Fold completes by this progress; plane takes over after. */
export const FOLD_END_PROGRESS = 0.38;

type BoardingPassFoldExitProps = {
  progress: SharedValue<number>;
  height: number;
  children: ReactNode;
};

/**
 * Smooth boarding-pass fold along the perforation. Card fades out before the plane flies.
 */
export function BoardingPassFoldExit({ progress, height, children }: BoardingPassFoldExitProps) {
  const half = height > 0 ? height / 2 : 1;

  const shellOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [FOLD_END_PROGRESS, FOLD_END_PROGRESS + 0.1],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  const topFlapStyle = useAnimatedStyle(() => {
    const foldP = interpolate(progress.value, [0, FOLD_END_PROGRESS], [0, 1], Extrapolation.CLAMP);
    const angle = interpolate(foldP, [0, 1], [0, -86]);
    return {
      transform: [
        { perspective: 1200 },
        { translateY: half / 2 },
        { rotateX: `${angle}deg` },
        { translateY: -half / 2 },
      ],
    };
  });

  const bottomFlapStyle = useAnimatedStyle(() => {
    const foldP = interpolate(progress.value, [0, FOLD_END_PROGRESS], [0, 1], Extrapolation.CLAMP);
    const angle = interpolate(foldP, [0, 1], [0, 86]);
    return {
      transform: [
        { perspective: 1200 },
        { translateY: -half / 2 },
        { rotateX: `${angle}deg` },
        { translateY: half / 2 },
      ],
    };
  });

  if (height <= 0) {
    return <View style={styles.fill}>{children}</View>;
  }

  return (
    <Animated.View style={[styles.fill, shellOpacity]}>
      <View style={{ height: half, overflow: "hidden" }}>
        <Animated.View style={topFlapStyle}>
          <View style={{ height }}>{children}</View>
        </Animated.View>
      </View>
      <View style={{ height: half, overflow: "hidden" }}>
        <Animated.View style={[{ marginTop: -half }, bottomFlapStyle]}>
          <View style={{ height }}>{children}</View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
