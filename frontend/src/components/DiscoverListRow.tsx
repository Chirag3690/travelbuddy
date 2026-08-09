import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { BoardingPassFoldExit } from "@/src/components/BoardingPassFoldExit";
import {
  FlyingPlaneExit,
  randomPlanePath,
  DEFAULT_PLANE_PATH,
} from "@/src/components/FlyingPlaneExit";
import { RubberStamp, type StampPalette } from "@/src/components/RubberStamp";
import type { DesignPreset } from "@/src/lib/theme-presets";
import type { ThemeColors } from "@/src/lib/theme-presets";

type ListItem = {
  user_id?: string;
  group_id?: string;
  name: string;
  age?: number;
  bio: string;
  location: string;
  photos?: string[];
  picture?: string | null;
  destinations?: string[];
  member_count?: number;
  max_members?: number;
};

type Props = {
  item: ListItem;
  isGroup: boolean;
  colors: ThemeColors;
  stampPalette: StampPalette;
  preset: DesignPreset;
  goIcon: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  onGo: (item: ListItem) => void;
  onExitComplete: (item: ListItem) => void;
  onExitStart: (id: string) => void;
};

function ListRowCard({
  item,
  isGroup,
  colors,
  goIcon,
  disabled,
  onGoPress,
  onLayout,
  showButton,
}: {
  item: ListItem;
  isGroup: boolean;
  colors: ThemeColors;
  goIcon: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  onGoPress: () => void;
  onLayout?: (height: number) => void;
  showButton: boolean;
}) {
  const id = item.group_id || item.user_id || "";

  return (
    <View
      style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.height)}
      testID={`list-card-${id}`}
    >
      <Image
        source={{ uri: item.photos?.[0] || item.picture || undefined }}
        style={styles.listThumb}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.listName, { color: colors.textPrimary }]}>
          {isGroup ? item.name : `${item.name}, ${item.age}`}
        </Text>
        <Text style={[styles.listLoc, { color: colors.textSecondary }]}>
          <Ionicons name="location-outline" size={12} /> {item.location}
          {isGroup ? ` · ${item.member_count}/${item.max_members} members` : ""}
        </Text>
        {!!item.destinations?.length && (
          <Text style={[styles.listGoing, { color: colors.primary }]} numberOfLines={1}>
            Going to {item.destinations.slice(0, 2).join(" · ")}
          </Text>
        )}
        <Text style={[styles.listBio, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.bio}
        </Text>
      </View>
      {showButton ? (
        <TouchableOpacity
          style={[styles.listLikeBtn, { backgroundColor: colors.primary }]}
          onPress={onGoPress}
          disabled={disabled}
          testID={`list-like-${id}`}
        >
          <Ionicons name={goIcon} size={16} color={colors.onPrimary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function useImprintStyle(
  imprintProgress: SharedValue<number>,
  exitProgress: SharedValue<number>
) {
  return useAnimatedStyle(() => {
    const stampIn = interpolate(imprintProgress.value, [0, 1], [0, 0.88]);
    const fadeForFold = interpolate(exitProgress.value, [0, 0.2], [1, 0], Extrapolation.CLAMP);
    return {
      opacity: stampIn * fadeForFold,
      transform: [{ scale: interpolate(imprintProgress.value, [0, 1], [1.12, 1]) }],
    };
  });
}

export default function DiscoverListRow({
  item,
  isGroup,
  colors,
  stampPalette,
  preset,
  goIcon,
  disabled,
  onGo,
  onExitComplete,
  onExitStart,
}: Props) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const id = item.group_id || item.user_id || "";
  const [exiting, setExiting] = useState(false);
  const [rowHeight, setRowHeight] = useState(0);
  const [planeFlightKey, setPlaneFlightKey] = useState(0);
  const committingRef = useRef(false);

  const exitProgress = useSharedValue(0);
  const imprintProgress = useSharedValue(0);
  const planePath = useSharedValue(DEFAULT_PLANE_PATH);
  const imprintStyle = useImprintStyle(imprintProgress, exitProgress);

  const finishExit = useCallback(() => {
    committingRef.current = false;
    onExitComplete(item);
  }, [item, onExitComplete]);

  const commitGo = useCallback(() => {
    if (committingRef.current || disabled) return;
    committingRef.current = true;
    onExitStart(id);
    planePath.value = randomPlanePath(true, viewportWidth, viewportHeight);
    setPlaneFlightKey((k) => k + 1);
    setExiting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onGo(item);
    imprintProgress.value = 0;
    imprintProgress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    exitProgress.value = 0;
    exitProgress.value = withDelay(
      300,
      withTiming(
        1,
        { duration: 1480, easing: Easing.bezier(0.35, 0, 0.2, 1) },
        (done) => {
          if (done) runOnJS(finishExit)();
        }
      )
    );
  }, [
    disabled,
    id,
    item,
    onExitStart,
    onGo,
    finishExit,
    exitProgress,
    imprintProgress,
    planePath,
    viewportWidth,
    viewportHeight,
  ]);

  if (exiting) {
    return (
      <>
        <View style={styles.listRowWrap}>
          <BoardingPassFoldExit progress={exitProgress} height={rowHeight}>
            <View style={styles.listMeasure}>
              <ListRowCard
                item={item}
                isGroup={isGroup}
                colors={colors}
                goIcon={goIcon}
                showButton={false}
                onGoPress={commitGo}
                onLayout={setRowHeight}
              />
              <Animated.View style={[styles.imprintSlot, imprintStyle]} pointerEvents="none">
                <View style={styles.listImprintScale}>
                  <RubberStamp
                    variant="accepted"
                    size="imprint"
                    palette={stampPalette}
                    preset={preset}
                  />
                </View>
              </Animated.View>
            </View>
          </BoardingPassFoldExit>
        </View>
        <Modal visible transparent animationType="none" statusBarTranslucent>
          <View style={styles.planeOverlay} pointerEvents="none">
            <FlyingPlaneExit
              key={planeFlightKey}
              progress={exitProgress}
              path={planePath}
              color={colors.success}
            />
          </View>
        </Modal>
      </>
    );
  }

  return (
    <View style={styles.listRowWrap}>
      <ListRowCard
        item={item}
        isGroup={isGroup}
        colors={colors}
        goIcon={goIcon}
        disabled={disabled}
        showButton
        onGoPress={commitGo}
        onLayout={setRowHeight}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listRowWrap: {
    marginBottom: 10,
    overflow: "visible",
  },
  listMeasure: {
    position: "relative",
  },
  listCard: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  listThumb: { width: 66, height: 84, borderRadius: 12, marginRight: 12, backgroundColor: "#eee" },
  listName: { fontSize: 16, fontWeight: "700" },
  listLoc: { fontSize: 12, marginTop: 2 },
  listGoing: { fontSize: 12, marginTop: 4, fontWeight: "600" },
  listBio: { fontSize: 13, marginTop: 4 },
  listLikeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  imprintSlot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 4,
  },
  listImprintScale: {
    transform: [{ scale: 0.72 }],
  },
  planeOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
