import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";
import { COLORS } from "@/src/lib/api";
import type { DesignPreset, ThemeColors } from "@/src/lib/theme-presets";
import { LEGACY_LIGHT } from "@/src/lib/theme-presets";
import type { StampVariant } from "@/src/components/RubberStamp.types";

export type { StampVariant };

export type StampPalette = {
  accent: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
  secondary: string;
  success: string;
  error: string;
  chipBg: string;
  wood: readonly [string, string, string, string];
  metal: readonly [string, string, string];
  handleBorder: string;
  metalBorder: string;
  grain: string;
};

function clampByte(n: number) {
  return Math.min(255, Math.max(0, Math.round(n)));
}

function parseHex(hex: string) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, "0")).join("")}`;
}

function shadeHex(hex: string, factor: number) {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
}

function mixHex(a: string, b: string, t: number) {
  const c1 = parseHex(a);
  const c2 = parseHex(b);
  if (!c1 || !c2) return a;
  return toHex(
    c1.r + (c2.r - c1.r) * t,
    c1.g + (c2.g - c1.g) * t,
    c1.b + (c2.b - c1.b) * t
  );
}

function withAlpha(hex: string, alpha: number) {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

export function stampPaletteFromTheme(colors: ThemeColors, preset: DesignPreset): StampPalette {
  const isVinci = preset === "vinci";

  const wood: StampPalette["wood"] = isVinci
    ? [
        mixHex(colors.elevated, colors.primary, 0.2),
        colors.surface,
        colors.border,
        shadeHex(colors.chipBg, 0.9),
      ]
    : [
        mixHex(colors.accent, "#D4A574", 0.5),
        mixHex(colors.primaryHover, colors.accent, 0.35),
        shadeHex(colors.primaryHover, 0.88),
        shadeHex(colors.textPrimary, 0.5),
      ];

  const metal: StampPalette["metal"] = isVinci
    ? [colors.textSecondary, colors.border, shadeHex(colors.border, 0.7)]
    : [mixHex(colors.accent, colors.border, 0.45), colors.textSecondary, shadeHex(colors.textSecondary, 0.75)];

  return {
    accent: colors.accent,
    surface: colors.surface,
    border: colors.border,
    textPrimary: colors.textPrimary,
    textSecondary: colors.textSecondary,
    primary: colors.primary,
    secondary: colors.secondary,
    success: colors.success,
    error: colors.error,
    chipBg: colors.chipBg,
    wood,
    metal,
    handleBorder: withAlpha(colors.textPrimary, isVinci ? 0.22 : 0.3),
    metalBorder: withAlpha(colors.accent, isVinci ? 0.4 : 0.48),
    grain: withAlpha(colors.textPrimary, 0.18),
  };
}

const DEFAULT_PALETTE = stampPaletteFromTheme(
  {
    ...LEGACY_LIGHT,
    elevated: LEGACY_LIGHT.surface,
  },
  "legacy"
);

type StampMeta = {
  label: string;
  sublabel: string;
  rubber: string;
  rubberHi: string;
  rubberLo: string;
  ink: string;
  inkText: string;
  inkFaint: string;
  emboss: string;
};

/** Boarding-pass ink + rubber colors tied to app semantics (go / hold). */
function metaFor(variant: StampVariant, palette: StampPalette, preset: DesignPreset): StampMeta {
  const isVinci = preset === "vinci";

  if (variant === "accepted") {
    const ink = isVinci
      ? mixHex(palette.success, palette.primary, 0.35)
      : mixHex(palette.success, palette.secondary, 0.18);
    return {
      label: "CLEARED",
      sublabel: "BOARDING",
      rubber: shadeHex(ink, 0.48),
      rubberHi: mixHex(ink, palette.success, 0.15),
      rubberLo: shadeHex(ink, 0.32),
      ink,
      inkText: shadeHex(ink, 0.68),
      inkFaint: withAlpha(ink, 0.18),
      emboss: "rgba(255,252,245,0.94)",
    };
  }

  const ink = palette.error;
  return {
    label: "NO GO",
    sublabel: "STANDBY",
    rubber: shadeHex(ink, 0.46),
    rubberHi: mixHex(ink, "#FFFFFF", 0.08),
    rubberLo: shadeHex(ink, 0.3),
    ink,
    inkText: shadeHex(ink, 0.7),
    inkFaint: withAlpha(ink, 0.18),
    emboss: "rgba(255,252,245,0.94)",
  };
}

function wobblyCircle(cx: number, cy: number, r: number, wobble: number) {
  const n = 36;
  let d = "";
  for (let i = 0; i <= n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const w = wobble * Math.sin(i * 2.35 + 0.5);
    const x = cx + (r + w) * Math.cos(angle);
    const y = cy + (r + w * 0.88) * Math.sin(angle);
    d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d} Z`;
}

function starPath(cx: number, cy: number, r: number) {
  const spikes = 5;
  let d = "";
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.42;
    const x = cx + rad * Math.cos(angle);
    const y = cy + rad * Math.sin(angle);
    d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d} Z`;
}

function PhysicalStamp({ meta, palette }: { meta: StampMeta; palette: StampPalette }) {
  const handleW = 24;
  const handleH = 30;
  const plateW = 54;
  const plateH = 5;
  const rubberW = 52;
  const rubberH = 20;

  return (
    <View style={styles.physical}>
      <View style={[styles.handleShadow, { width: handleW + 4, height: handleH + 2 }]}>
        <LinearGradient
          colors={[...palette.wood]}
          locations={[0, 0.35, 0.72, 1]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={[
            styles.handle,
            {
              width: handleW,
              height: handleH,
              borderTopLeftRadius: 6,
              borderTopRightRadius: 6,
              borderColor: palette.handleBorder,
            },
          ]}
        >
          <View style={[styles.grain, { width: handleW * 0.55, backgroundColor: palette.grain }]} />
          <View
            style={[
              styles.grain,
              { width: handleW * 0.38, marginTop: 4, opacity: 0.45, backgroundColor: palette.grain },
            ]}
          />
        </LinearGradient>
      </View>

      <LinearGradient
        colors={[...palette.metal]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.metalPlate, { width: plateW, height: plateH, borderColor: palette.metalBorder }]}
      />

      <View style={[styles.rubberShadow, { width: rubberW + 6, height: rubberH + 4 }]}>
        <LinearGradient
          colors={[meta.rubberHi, meta.rubber, meta.rubberLo]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={[
            styles.rubber,
            {
              width: rubberW,
              height: rubberH,
              borderColor: withAlpha(meta.ink, 0.35),
            },
          ]}
        >
          <View style={[styles.rubberBevel, { backgroundColor: "rgba(255,255,255,0.14)" }]} />
          <Text style={[styles.embossText, { color: meta.emboss }]} numberOfLines={1}>
            {meta.label}
          </Text>
        </LinearGradient>
      </View>
    </View>
  );
}

/** Circular boarding-pass ink mark on the card. */
function InkImprint({ meta }: { meta: StampMeta }) {
  const size = 122;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 5;
  const innerR = outerR - 9;
  const starR = 3.1;
  const starDist = outerR - 13;
  const mainSize = meta.label.length > 6 ? 11 : 13;
  const mainTracking = meta.label.length > 6 ? 1.2 : 1.6;

  const speckles: [number, number, number][] = [
    [0.2, 0.24, 1.2],
    [0.8, 0.2, 1.0],
    [0.72, 0.76, 1.3],
    [0.26, 0.74, 0.9],
    [0.5, 0.14, 0.8],
    [0.14, 0.48, 1.1],
    [0.88, 0.46, 0.95],
  ];

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} pointerEvents="none">
        <Circle cx={cx} cy={cy} r={outerR - 2} fill={meta.inkFaint} opacity={0.42} />
        <Path
          d={wobblyCircle(cx, cy, outerR, 2.6)}
          fill="none"
          stroke={meta.ink}
          strokeWidth={2.8}
          strokeOpacity={0.78}
          strokeLinejoin="round"
        />
        <Path
          d={wobblyCircle(cx, cy, innerR, 1.6)}
          fill="none"
          stroke={meta.ink}
          strokeWidth={1.2}
          strokeOpacity={0.42}
          strokeDasharray="4 3"
        />
        {[0, 1, 2, 3].map((i) => {
          const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
          const sx = cx + starDist * Math.cos(angle);
          const sy = cy + starDist * Math.sin(angle);
          return <Path key={i} d={starPath(sx, sy, starR)} fill={meta.ink} opacity={0.55} />;
        })}
        {speckles.map(([nx, ny, r], i) => (
          <Circle
            key={`speckle-${i}`}
            cx={nx * size}
            cy={ny * size}
            r={r}
            fill={meta.ink}
            opacity={0.12 + (i % 3) * 0.05}
          />
        ))}
      </Svg>
      <View style={styles.imprintCenter} pointerEvents="none">
        <Text
          style={[
            styles.imprintShadow,
            { color: meta.inkText, fontSize: mainSize, letterSpacing: mainTracking },
          ]}
          numberOfLines={1}
        >
          {meta.label}
        </Text>
        <Text
          style={[
            styles.imprintMain,
            { color: meta.inkText, fontSize: mainSize, letterSpacing: mainTracking },
          ]}
          numberOfLines={1}
        >
          {meta.label}
        </Text>
        <Text style={[styles.imprintSub, { color: meta.inkText }]} numberOfLines={1}>
          {meta.sublabel}
        </Text>
      </View>
    </View>
  );
}

type RubberStampProps = {
  variant: StampVariant;
  size?: "dock" | "imprint";
  palette?: StampPalette;
  preset?: DesignPreset;
  showHandle?: boolean;
  style?: ViewStyle;
};

export function RubberStamp({
  variant,
  size = "dock",
  palette = DEFAULT_PALETTE,
  preset = "legacy",
  showHandle = true,
  style,
}: RubberStampProps) {
  const meta = metaFor(variant, palette, preset);
  const isImprint = size === "imprint";

  if (isImprint) {
    return (
      <View style={[styles.wrap, style, { transform: [{ rotate: "-11deg" }] }]}>
        <InkImprint meta={meta} />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style, { transform: [{ rotate: "-6deg" }] }]}>
      {showHandle ? <PhysicalStamp meta={meta} palette={palette} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  physical: { alignItems: "center" },
  handleShadow: {
    alignItems: "center",
    justifyContent: "flex-end",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowOffset: { width: 1, height: 3 },
    shadowRadius: 4,
    elevation: 5,
  },
  handle: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  grain: { height: 1.5, borderRadius: 1 },
  metalPlate: { marginTop: -1, borderWidth: StyleSheet.hairlineWidth },
  rubberShadow: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -1,
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowOffset: { width: 2, height: 4 },
    shadowRadius: 5,
    elevation: 6,
  },
  rubber: {
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
  rubberBevel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  embossText: {
    fontSize: 7.5,
    fontWeight: "900",
    letterSpacing: 0.6,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  imprintCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  imprintShadow: {
    position: "absolute",
    fontWeight: "900",
    opacity: 0.35,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  imprintMain: {
    fontWeight: "900",
    opacity: 0.96,
    textShadowColor: "rgba(255,255,255,0.35)",
    textShadowOffset: { width: -0.5, height: -0.5 },
    textShadowRadius: 0,
  },
  imprintSub: {
    marginTop: 2,
    fontSize: 6.5,
    fontWeight: "800",
    letterSpacing: 2.2,
    opacity: 0.78,
  },
});
