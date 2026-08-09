import { StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { FOLD_END_PROGRESS } from "@/src/components/BoardingPassFoldExit";

export type PlanePathKind = "quad" | "cubic" | "arc";

export type PlanePathConfig = {
  kind: PlanePathKind;
  wobble: number;
  cx: number;
  cy: number;
  c2x: number;
  c2y: number;
  endX: number;
  endY: number;
  arcCx: number;
  arcCy: number;
  radius: number;
  startAngle: number;
  sweep: number;
};

export const DEFAULT_PLANE_PATH: PlanePathConfig = {
  kind: "quad",
  cx: 70,
  cy: -90,
  c2x: 0,
  c2y: 0,
  endX: 260,
  endY: -520,
  arcCx: 0,
  arcCy: 0,
  radius: 0,
  startAngle: 0,
  sweep: 0,
  wobble: 18,
};

/** Off-screen target from card center (coordinates are relative to screen center). */
function exitTarget(flyRight: boolean, vw: number, vh: number) {
  const dir = flyRight ? 1 : -1;
  return {
    endX: dir * (vw * 0.56 + 28) * (0.9 + Math.random() * 0.18),
    endY: -(vh * 0.52 + 36) * (0.92 + Math.random() * 0.14),
  };
}

/** Random flight that always finishes beyond the viewport edge. */
export function randomPlanePath(
  flyRight: boolean,
  viewportWidth: number,
  viewportHeight: number
): PlanePathConfig {
  const dir = flyRight ? 1 : -1;
  const { endX, endY } = exitTarget(flyRight, viewportWidth, viewportHeight);
  const roll = Math.random();

  if (roll < 0.38) {
    const radius = 42 + Math.random() * 72;
    const sweep =
      Math.PI * (0.75 + Math.random() * 1.55) * (Math.random() > 0.5 ? 1 : -1);
    return {
      kind: "arc",
      arcCx: dir * (8 + Math.random() * 50),
      arcCy: -18 - Math.random() * 60,
      radius,
      startAngle: -Math.PI / 2 + (Math.random() - 0.5) * 1.2,
      sweep,
      wobble: 4 + Math.random() * 10,
      cx: 0,
      cy: 0,
      c2x: 0,
      c2y: 0,
      endX,
      endY,
    };
  }

  if (roll < 0.72) {
    return {
      kind: "cubic",
      cx: dir * (endX * (0.22 + Math.random() * 0.18)),
      cy: endY * (0.18 + Math.random() * 0.12),
      c2x: dir * (endX * (0.48 + Math.random() * 0.22)),
      c2y: endY * (0.52 + Math.random() * 0.18),
      endX,
      endY,
      wobble: 5 + Math.random() * 18,
      arcCx: 0,
      arcCy: 0,
      radius: 0,
      startAngle: 0,
      sweep: 0,
    };
  }

  return {
    kind: "quad",
    cx: dir * (endX * (0.28 + Math.random() * 0.2)),
    cy: endY * (0.2 + Math.random() * 0.15),
    c2x: 0,
    c2y: 0,
    endX,
    endY,
    wobble: 6 + Math.random() * 22,
    arcCx: 0,
    arcCy: 0,
    radius: 0,
    startAngle: 0,
    sweep: 0,
  };
}

const ICON_NOSE_OFFSET = 45;
const ARC_LOOP_FRAC = 0.68;

function arcPoint(t: number, p: PlanePathConfig, wobbleScale: number) {
  "worklet";
  const wobble = p.wobble * (1 - t) * wobbleScale;
  const angle = p.startAngle + p.sweep * t;
  return {
    x:
      p.arcCx +
      p.radius * Math.cos(angle) +
      Math.sin(t * Math.PI * 3.1) * wobble * 0.35,
    y:
      p.arcCy +
      p.radius * Math.sin(angle) +
      Math.cos(t * Math.PI * 2.4) * wobble * 0.28,
  };
}

function pathPoint(t: number, p: PlanePathConfig) {
  "worklet";
  const wobble = p.wobble * (1 - t);

  if (p.kind === "arc") {
    if (t <= ARC_LOOP_FRAC) {
      return arcPoint(t / ARC_LOOP_FRAC, p, 1);
    }
    const u = (t - ARC_LOOP_FRAC) / (1 - ARC_LOOP_FRAC);
    const loopEnd = arcPoint(1, p, 0);
    return {
      x: loopEnd.x + u * (p.endX - loopEnd.x),
      y: loopEnd.y + u * (p.endY - loopEnd.y),
    };
  }

  if (p.kind === "cubic") {
    const u = 1 - t;
    const u2 = u * u;
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x:
        3 * u2 * t * p.cx +
        3 * u * t2 * p.c2x +
        t3 * p.endX +
        Math.sin(t * Math.PI * 2.6) * wobble * 0.35,
      y:
        6 * u2 +
        3 * u2 * t * p.cy +
        3 * u * t2 * p.c2y +
        t3 * p.endY +
        Math.cos(t * Math.PI * 2) * wobble * 0.28,
    };
  }

  const u = 1 - t;
  return {
    x:
      2 * u * t * p.cx +
      t * t * p.endX +
      Math.sin(t * Math.PI * 2.8) * wobble * 0.4,
    y:
      6 * u * u +
      2 * u * t * p.cy +
      t * t * p.endY +
      Math.cos(t * Math.PI * 2.1) * wobble * 0.35,
  };
}

function pathHeading(t: number, p: PlanePathConfig) {
  "worklet";
  const dt = p.kind === "arc" ? 0.018 : 0.028;
  const t0 = Math.max(t - dt, 0);
  const t1 = Math.min(t + dt, 1);
  const p0 = pathPoint(t0, p);
  const p1 = pathPoint(t1, p);
  const vx = p1.x - p0.x;
  const vy = p1.y - p0.y;
  if (vx * vx + vy * vy < 0.0001) {
    return ICON_NOSE_OFFSET;
  }
  return (Math.atan2(vy, vx) * 180) / Math.PI + ICON_NOSE_OFFSET;
}

type FlyingPlaneExitProps = {
  progress: SharedValue<number>;
  path: SharedValue<PlanePathConfig>;
  color: string;
};

export function FlyingPlaneExit({ progress, path, color }: FlyingPlaneExitProps) {
  const { width, height } = useWindowDimensions();
  const exitMarginX = width * 0.52 + 24;
  const exitMarginY = height * 0.5 + 28;
  const flyStart = FOLD_END_PROGRESS;

  const planeStyle = useAnimatedStyle(() => {
    const flyP = interpolate(
      progress.value,
      [flyStart, flyStart + 0.06, 1],
      [0, 0.08, 1],
      Extrapolation.CLAMP
    );
    const p = path.value;
    const pos = pathPoint(flyP, p);
    const heading = pathHeading(flyP, p);
    const scale = interpolate(flyP, [0, 0.18, 1], [0.45, 0.8, 0.92]);

    const pastEdge =
      Math.abs(pos.x) > exitMarginX || Math.abs(pos.y) > exitMarginY;
    const fadeIn = interpolate(flyP, [0, 0.07], [0, 1], Extrapolation.CLAMP);
    const fadeOut = pastEdge
      ? interpolate(flyP, [0.96, 1], [1, 0], Extrapolation.CLAMP)
      : 1;

    return {
      opacity: fadeIn * fadeOut,
      transform: [
        { translateX: pos.x },
        { translateY: pos.y },
        { rotate: `${heading}deg` },
        { scale },
      ],
    };
  }, [exitMarginX, exitMarginY]);

  return (
    <Animated.View style={styles.layer} pointerEvents="none">
      <Animated.View style={[styles.planeWrap, planeStyle]}>
        <Ionicons name="paper-plane" size={32} color={color} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
  },
  planeWrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
