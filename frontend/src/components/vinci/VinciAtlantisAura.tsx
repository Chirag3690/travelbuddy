import { useEffect } from "react";
import { StyleSheet, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/src/lib/theme";

const { width: W, height: H } = Dimensions.get("window");

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

function DriftOrb({
  size,
  left,
  top,
  colors,
  delay = 0,
}: {
  size: number;
  left: number;
  top: number;
  colors: [string, string, string];
  delay?: number;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    const id = setTimeout(() => {
      t.value = withRepeat(
        withTiming(1, { duration: 6800 + delay * 400, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
    }, delay * 120);
    return () => clearTimeout(id);
  }, [t, delay]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 1], [0, 22]) },
      { translateY: interpolate(t.value, [0, 1], [0, -18]) },
      { scale: interpolate(t.value, [0, 0.5, 1], [0.92, 1.14, 0.96]) },
    ],
    opacity: interpolate(t.value, [0, 0.5, 1], [0.35, 0.72, 0.4]),
  }));

  return (
    <AnimatedGradient
      colors={colors}
      style={[
        {
          position: "absolute",
          left,
          top,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
      start={{ x: 0.2, y: 0.2 }}
      end={{ x: 0.9, y: 0.9 }}
    />
  );
}

/** Bioluminescent Atlantis wash — drifting cyan, violet, amber */
export default function VinciAtlantisAura() {
  const { colors, isVinci } = useTheme();
  if (!isVinci) return null;

  const cyan = colors.primary;
  const violet = colors.secondary;
  const gold = colors.accent;

  return (
  <>
    <LinearGradient
      colors={[`${colors.bg}00`, `${cyan}22`, `${violet}18`, `${colors.bg}EE`]}
      locations={[0, 0.35, 0.65, 1]}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
    <DriftOrb
      size={W * 0.72}
      left={-W * 0.22}
      top={H * 0.08}
      colors={[`${cyan}55`, `${violet}33`, "transparent"]}
      delay={0}
    />
    <DriftOrb
      size={W * 0.58}
      left={W * 0.52}
      top={H * 0.42}
      colors={[`${violet}44`, `${cyan}28`, "transparent"]}
      delay={2}
    />
    <DriftOrb
      size={W * 0.48}
      left={W * 0.08}
      top={H * 0.62}
      colors={[`${gold}40`, `${cyan}22`, "transparent"]}
      delay={4}
    />
    <DriftOrb
      size={W * 0.4}
      left={W * 0.62}
      top={-H * 0.04}
      colors={[`${gold}35`, `${violet}25`, "transparent"]}
      delay={1}
    />
  </>
  );
}
