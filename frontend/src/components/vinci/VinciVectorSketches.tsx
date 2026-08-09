import { useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Svg, { Circle, G, Line, Path, Polygon } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/src/lib/theme";

const { width: W, height: H } = Dimensions.get("window");

type SketchProps = {
  size: number;
  color: string;
  glow?: string;
  opacity?: number;
  style?: object;
};

const AnimatedView = Animated.createAnimatedComponent(View);

function useFloat(duration = 9000, range = 14) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [v, duration]);
  return useAnimatedStyle(() => ({
    transform: [
      { translateY: (v.value - 0.5) * range * 2 },
      { rotate: `${(v.value - 0.5) * 6}deg` },
    ],
  }));
}

/** Fibonacci / golden spiral study */
export function SpiralSketch({ size, color, glow, opacity = 0.55, style }: SketchProps) {
  const anim = useFloat(11000, 10);
  const s = size;
  return (
    <AnimatedView style={[style, anim]}>
      <Svg width={s} height={s} viewBox="0 0 100 100">
        <Path
          d="M50 50 Q72 50 72 28 Q72 8 50 8 Q22 8 22 32 Q22 58 50 58 Q78 58 78 78 Q78 96 50 96"
          stroke={glow || color}
          strokeWidth={0.9}
          fill="none"
          opacity={opacity}
        />
        <Circle cx={50} cy={50} r={46} stroke={color} strokeWidth={0.5} fill="none" opacity={opacity * 0.6} />
      </Svg>
    </AnimatedView>
  );
}

/** Da Vinci compass / star of lines */
export function CompassVector({ size, color, glow, opacity = 0.6, style }: SketchProps) {
  const anim = useFloat(8000, 8);
  const c = size / 2;
  const r = size * 0.42;
  return (
    <AnimatedView style={[style, anim]}>
      <Svg width={size} height={size}>
        <G opacity={opacity}>
          {[0, 45, 90, 135].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <Line
                key={deg}
                x1={c}
                y1={c}
                x2={c + Math.cos(rad) * r}
                y2={c + Math.sin(rad) * r}
                stroke={glow || color}
                strokeWidth={1}
              />
            );
          })}
          <Circle cx={c} cy={c} r={r} stroke={color} strokeWidth={0.8} fill="none" />
          <Circle cx={c} cy={c} r={r * 0.55} stroke={color} strokeWidth={0.5} fill="none" />
        </G>
      </Svg>
    </AnimatedView>
  );
}

/** Wing / flight study curves */
export function WingVector({ size, color, glow, opacity = 0.5, style }: SketchProps) {
  const anim = useFloat(9500, 12);
  return (
    <AnimatedView style={[style, anim]}>
      <Svg width={size} height={size * 0.55} viewBox="0 0 120 66">
        <Path
          d="M8 48 C30 42 55 28 75 18 C90 12 100 8 112 6 M12 52 C35 46 58 34 78 24 C92 18 102 14 112 12 M20 56 C42 50 62 40 82 32"
          stroke={glow || color}
          strokeWidth={1.1}
          fill="none"
          opacity={opacity}
        />
        <Path
          d="M25 38 C45 30 65 22 95 14"
          stroke={color}
          strokeWidth={0.7}
          fill="none"
          opacity={opacity * 0.7}
        />
      </Svg>
    </AnimatedView>
  );
}

/** Vitruvian circle + square */
export function VitruvianVector({ size, color, glow, opacity = 0.45, style }: SketchProps) {
  const anim = useFloat(12000, 6);
  const c = size / 2;
  return (
    <AnimatedView style={[style, anim]}>
      <Svg width={size} height={size}>
        <G opacity={opacity}>
          <Circle cx={c} cy={c} r={size * 0.4} stroke={glow || color} strokeWidth={0.9} fill="none" />
          <Polygon
            points={`${c},${c - size * 0.32} ${c + size * 0.32},${c} ${c},${c + size * 0.32} ${c - size * 0.32},${c}`}
            stroke={color}
            strokeWidth={0.7}
            fill="none"
            transform={`rotate(12 ${c} ${c})`}
          />
          <Line x1={c - size * 0.15} y1={c - size * 0.2} x2={c + size * 0.08} y2={c + size * 0.22} stroke={color} strokeWidth={0.6} />
          <Line x1={c} y1={c - size * 0.18} x2={c} y2={c + size * 0.2} stroke={color} strokeWidth={0.5} />
        </G>
      </Svg>
    </AnimatedView>
  );
}

/** Platonic / polyhedron wireframe */
export function PolyhedronVector({ size, color, glow, opacity = 0.4, style }: SketchProps) {
  const anim = useFloat(10000, 9);
  const c = size / 2;
  return (
    <AnimatedView style={[style, anim]}>
      <Svg width={size} height={size}>
        <G opacity={opacity}>
          <Polygon
            points={`${c},${size * 0.12} ${size * 0.82},${size * 0.38} ${size * 0.68},${size * 0.88} ${size * 0.18},${size * 0.88} ${size * 0.05},${size * 0.38}`}
            stroke={glow || color}
            strokeWidth={0.8}
            fill="none"
          />
          <Line x1={c} y1={size * 0.12} x2={c} y2={size * 0.55} stroke={color} strokeWidth={0.6} />
          <Line x1={size * 0.82} y1={size * 0.38} x2={c} y2={size * 0.55} stroke={color} strokeWidth={0.6} />
          <Line x1={size * 0.18} y1={size * 0.38} x2={c} y2={size * 0.55} stroke={color} strokeWidth={0.6} />
        </G>
      </Svg>
    </AnimatedView>
  );
}

/** Helix — Atlantis / trippy depth cue */
export function HelixVector({ size, color, glow, opacity = 0.35, style }: SketchProps) {
  const anim = useFloat(7000, 16);
  return (
    <AnimatedView style={[style, anim]}>
      <Svg width={size * 0.35} height={size} viewBox="0 0 40 120">
        <Path
          d="M20 4 Q32 20 20 36 Q8 52 20 68 Q32 84 20 100 Q8 116 20 116"
          stroke={glow || color}
          strokeWidth={1}
          fill="none"
          opacity={opacity}
        />
        <Path
          d="M20 4 Q8 20 20 36 Q32 52 20 68 Q8 84 20 100"
          stroke={color}
          strokeWidth={0.6}
          fill="none"
          opacity={opacity * 0.65}
        />
      </Svg>
    </AnimatedView>
  );
}

type Layout = "screen" | "login" | "compact";

/** Layout-aware Da Vinci vector layer */
export default function VinciVectorSketches({ layout = "screen" }: { layout?: Layout }) {
  const { colors, isVinci } = useTheme();
  if (!isVinci) return null;

  const line = colors.primary;
  const glow = colors.accent;
  const ink = colors.secondary;

  if (layout === "compact") {
    return (
      <View style={styles.compact} pointerEvents="none">
        <CompassVector size={56} color={line} glow={glow} opacity={0.65} />
      </View>
    );
  }

  if (layout === "login") {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <SpiralSketch size={W * 0.55} color={line} glow={glow} style={styles.loginSpiral} />
        <CompassVector size={W * 0.28} color={glow} glow={line} style={styles.loginCompass} />
        <VitruvianVector size={W * 0.38} color={ink} glow={glow} style={styles.loginVitruvian} />
        <WingVector size={W * 0.42} color={line} glow={glow} style={styles.loginWing} />
        <PolyhedronVector size={W * 0.22} color={glow} glow={line} style={styles.loginPoly} />
        <HelixVector size={H * 0.22} color={ink} glow={line} style={styles.loginHelix} />
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <SpiralSketch size={W * 0.5} color={line} glow={glow} opacity={0.28} style={styles.centerSpiral} />
      <CompassVector size={72} color={glow} glow={line} style={styles.topRight} />
      <WingVector size={110} color={line} glow={glow} style={styles.bottomLeft} />
      <VitruvianVector size={88} color={ink} glow={glow} style={styles.bottomRight} />
      <PolyhedronVector size={64} color={glow} glow={line} style={styles.topLeft} />
      <HelixVector size={H * 0.2} color={ink} glow={line} style={styles.midLeft} />
      <HelixVector size={H * 0.16} color={line} glow={glow} style={styles.midRight} />
    </View>
  );
}

const styles = StyleSheet.create({
  compact: { alignItems: "center", paddingVertical: 6 },
  centerSpiral: {
    position: "absolute",
    top: H * 0.28,
    left: W * 0.5 - W * 0.25,
    opacity: 0.9,
  },
  topRight: { position: "absolute", top: 88, right: 10 },
  topLeft: { position: "absolute", top: 120, left: 14 },
  bottomLeft: { position: "absolute", bottom: 130, left: 4 },
  bottomRight: { position: "absolute", bottom: 110, right: 2 },
  midLeft: { position: "absolute", top: H * 0.45, left: 0 },
  midRight: { position: "absolute", top: H * 0.38, right: 4 },
  loginSpiral: { position: "absolute", top: H * 0.12, left: W * 0.22, opacity: 0.85 },
  loginCompass: { position: "absolute", top: H * 0.16, right: "6%" },
  loginVitruvian: { position: "absolute", top: H * 0.2, left: "4%" },
  loginWing: { position: "absolute", bottom: H * 0.36, left: "8%" },
  loginPoly: { position: "absolute", top: H * 0.34, right: "12%" },
  loginHelix: { position: "absolute", bottom: H * 0.28, right: "18%" },
});
