import { useEffect, useMemo } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/lib/theme";

const SPRING = { damping: 20, stiffness: 260, mass: 0.75 };

export type SegmentOption<T extends string> = {
  key: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

type Props<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  testIDPrefix?: string;
  size?: "md" | "sm";
  /** filled = solid primary thumb (People/Squads). soft = tinted thumb (mode picker). */
  variant?: "filled" | "soft";
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function SegmentLabel<T extends string>({
  option,
  active,
  size,
  variant,
  onPress,
  testID,
  flex,
}: {
  option: SegmentOption<T>;
  active: boolean;
  size: "md" | "sm";
  variant: "filled" | "soft";
  onPress: () => void;
  testID?: string;
  flex: number;
}) {
  const { colors } = useTheme();
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, SPRING);
  }, [active, progress]);

  const activeColor = variant === "filled" ? colors.onPrimary : colors.primary;
  const inactiveColor = colors.textSecondary;

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [inactiveColor, activeColor]),
  }));

  const iconSize = size === "md" ? 15 : 13;
  const fontSize = size === "md" ? 13 : 12;

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[styles.segment, { flex }]}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {option.icon ? (
        <Ionicons name={option.icon} size={iconSize} color={active ? activeColor : inactiveColor} />
      ) : null}
      <Animated.Text
        style={[
          styles.label,
          { fontSize, fontWeight: size === "md" ? "800" : "700" },
          labelStyle,
        ]}
        numberOfLines={1}
      >
        {option.label}
      </Animated.Text>
    </AnimatedPressable>
  );
}

export default function AnimatedSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix = "segment",
  size = "md",
  variant = "filled",
  style,
}: Props<T>) {
  const { colors } = useTheme();
  const activeIndex = useMemo(
    () => Math.max(0, options.findIndex((o) => o.key === value)),
    [options, value]
  );

  const trackWidth = useSharedValue(0);
  const indexSv = useSharedValue(activeIndex);

  useEffect(() => {
    indexSv.value = withSpring(activeIndex, SPRING);
  }, [activeIndex, indexSv]);

  const inset = size === "md" ? 4 : 3;
  const thumbPad = size === "md" ? 8 : 6;

  const thumbStyle = useAnimatedStyle(() => {
    const w = trackWidth.value / Math.max(options.length, 1);
    return {
      width: Math.max(w - thumbPad, 0),
      transform: [{ translateX: indexSv.value * w + inset }],
    };
  });

  const onTrackLayout = (e: LayoutChangeEvent) => {
    trackWidth.value = e.nativeEvent.layout.width;
  };

  const pick = (key: T) => {
    if (key === value) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onChange(key);
  };

  const trackBg = colors.inputBg;
  const thumbBg =
    variant === "filled"
      ? colors.primary
      : colors.primarySoft;
  const thumbBorder = variant === "soft" ? colors.primary : "transparent";

  return (
    <View
      style={[
        styles.track,
        size === "sm" && styles.trackSm,
        { backgroundColor: trackBg, borderColor: colors.border },
        style,
      ]}
      onLayout={onTrackLayout}
    >
      <Animated.View
        style={[
          styles.thumb,
          size === "sm" && styles.thumbSm,
          {
            backgroundColor: thumbBg,
            borderColor: thumbBorder,
            shadowColor: variant === "filled" ? colors.primary : "#000",
          },
          thumbStyle,
        ]}
      />
      <View style={styles.row}>
        {options.map((option) => (
          <SegmentLabel
            key={option.key}
            option={option}
            active={option.key === value}
            size={size}
            variant={variant}
            flex={1}
            testID={`${testIDPrefix}-${option.key}`}
            onPress={() => pick(option.key)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    overflow: "hidden",
  },
  trackSm: {
    padding: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  thumb: {
    position: "absolute",
    top: 4,
    bottom: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  thumbSm: {
    top: 3,
    bottom: 3,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 6,
    zIndex: 1,
  },
  label: {
    letterSpacing: -0.2,
  },
});
