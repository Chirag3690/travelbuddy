import { useEffect } from "react";
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/lib/theme";

const SPRING = { damping: 22, stiffness: 280, mass: 0.7 };

export default function AnimatedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const trackWidth = useSharedValue(0);
  const indexSv = useSharedValue(state.index);

  useEffect(() => {
    indexSv.value = withSpring(state.index, SPRING);
  }, [state.index, indexSv]);

  const tabCount = state.routes.length;
  const inset = 6;
  const bottomPad = Math.max(insets.bottom, Platform.OS === "android" ? 12 : 8);

  const thumbStyle = useAnimatedStyle(() => {
    const w = trackWidth.value / Math.max(tabCount, 1);
    return {
      width: Math.max(w - inset * 2, 0),
      transform: [{ translateX: indexSv.value * w + inset }],
    };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.value = e.nativeEvent.layout.width;
  };

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: bottomPad,
        },
      ]}
    >
      <View style={styles.track} onLayout={onLayout}>
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: colors.primarySoft,
              borderColor: colors.primary,
            },
            thumbStyle,
          ]}
        />
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? String(options.tabBarLabel)
              : options.title ?? route.name;
          const isFocused = state.index === index;
          const color = isFocused ? colors.primary : colors.textSecondary;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: "tabLongPress", target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tab}
            >
              {options.tabBarIcon
                ? options.tabBarIcon({
                    focused: isFocused,
                    color,
                    size: 22,
                  })
                : null}
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    elevation: 8,
  },
  track: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 52,
    marginHorizontal: 8,
    borderRadius: 18,
    overflow: "hidden",
  },
  thumb: {
    position: "absolute",
    top: 4,
    bottom: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 2,
    zIndex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
  },
});
