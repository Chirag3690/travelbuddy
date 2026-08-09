import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
  Alert,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { api, COLORS, DISCOVER_GENDER_FILTERS, ModeKey } from "@/src/lib/api";
import SuggestInput from "@/src/components/SuggestInput";
import PhotoCarousel from "@/src/components/PhotoCarousel";
import { getModes, useTheme } from "@/src/lib/theme";
import VinciVectorSketches from "@/src/components/vinci/VinciVectorSketches";
import { RubberStamp, stampPaletteFromTheme, type StampVariant } from "@/src/components/RubberStamp";
import { DraggableRubberStamp } from "@/src/components/DraggableRubberStamp";
import { BoardingPassFoldExit } from "@/src/components/BoardingPassFoldExit";
import {
  FlyingPlaneExit,
  randomPlanePath,
  DEFAULT_PLANE_PATH,
  type PlanePathConfig,
} from "@/src/components/FlyingPlaneExit";
import AnimatedSegmentedControl from "@/src/components/AnimatedSegmentedControl";
import DismissibleBottomSheet from "@/src/components/DismissibleBottomSheet";
import DiscoverListRow from "@/src/components/DiscoverListRow";

type Profile = {
  user_id: string;
  name: string;
  age: number;
  bio: string;
  location: string;
  photos: string[];
  picture?: string | null;
  interests: string[];
  modes: string[];
  destinations?: string[];
  shared_destinations?: string[];
};

type TravelGroup = {
  group_id: string;
  name: string;
  bio: string;
  mode: string;
  location: string;
  destinations?: string[];
  photos: string[];
  member_count: number;
  max_members: number;
  members?: { user_id: string; name: string; picture?: string | null }[];
  visibility_score?: number;
};

export default function Discover() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const { colors, copy, preset, icons, isVinci } = useTheme();
  const stampPalette = useMemo(
    () => stampPaletteFromTheme(colors, preset),
    [colors, preset]
  );
  const modes = getModes(preset);
  const [mode, setMode] = useState<ModeKey>("events");
  const [targetType, setTargetType] = useState<"people" | "groups">("people");
  const [view, setView] = useState<"deck" | "list">("deck");
  const [cardImprint, setCardImprint] = useState<StampVariant | null>(null);
  const committingRef = useRef(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<TravelGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [destinationQuery, setDestinationQuery] = useState("");
  const [activeDestination, setActiveDestination] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [activeLocation, setActiveLocation] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [matchModal, setMatchModal] = useState<Profile | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchShared, setMatchShared] = useState<string[]>([]);
  const [cardHeight, setCardHeight] = useState(0);
  const [planeFlightKey, setPlaneFlightKey] = useState(0);
  const [listExitingId, setListExitingId] = useState<string | null>(null);
  const visibleModes = targetType === "groups"
    ? modes.filter((m) => m.key !== "situationship")
    : modes;

  const typeOptions = useMemo(
    () =>
      [
        { key: "people" as const, label: copy.typePeople, icon: "person-outline" as const },
        { key: "groups" as const, label: copy.typeSquads, icon: "people-outline" as const },
      ],
    [copy.typePeople, copy.typeSquads]
  );

  const modeOptions = useMemo(
    () =>
      visibleModes.map((m) => ({
        key: m.key,
        label: m.label,
        icon: m.icon,
      })),
    [visibleModes]
  );

  const exitProgress = useSharedValue(0);
  const imprintProgress = useSharedValue(0);
  const planePath = useSharedValue<PlanePathConfig>(DEFAULT_PLANE_PATH);
  const stackPeekSv = useSharedValue(66);

  const stackPeekBase = cardHeight > 0 ? Math.round(cardHeight * 0.23) : 66;

  useEffect(() => {
    stackPeekSv.value = stackPeekBase;
  }, [stackPeekBase, stackPeekSv]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const lo = parseInt(minAge, 10);
      const hi = parseInt(maxAge, 10);
      if (targetType === "groups") {
        const data = await api.discoverGroups(mode, {
          destination: activeDestination || undefined,
          location: activeLocation || undefined,
        });
        setGroups(data);
      } else {
        const data = await api.discover(mode, {
          destination: activeDestination || undefined,
          location: activeLocation || undefined,
          minAge: isNaN(lo) ? undefined : lo,
          maxAge: isNaN(hi) ? undefined : hi,
          genders: selectedGenders.length ? selectedGenders : undefined,
        });
        setProfiles(data);
      }
    } catch (e: any) {
      Alert.alert("Could not load", e.message || "");
    } finally {
      setLoading(false);
    }
  }, [targetType, mode, activeDestination, activeLocation, minAge, maxAge, selectedGenders]);

  useEffect(() => {
    setCardImprint(null);
    committingRef.current = false;
    exitProgress.value = 0;
    imprintProgress.value = 0;
    load();
  }, [load, exitProgress, imprintProgress]);

  useEffect(() => {
    if (targetType === "groups" && mode === "situationship") {
      setMode("trips");
    }
  }, [targetType, mode]);

  const deck = targetType === "groups" ? groups : profiles;
  const top = deck[0];
  const stackBehind = deck.slice(1, 3);

  useEffect(() => {
    if (!cardImprint) {
      exitProgress.value = 0;
      imprintProgress.value = 0;
    }
  }, [cardImprint, exitProgress, imprintProgress]);

  const toggleGender = (key: string) => {
    setSelectedGenders((prev) =>
      prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]
    );
  };

  const clearAllFilters = () => {
    setMinAge("");
    setMaxAge("");
    setSelectedGenders([]);
    setLocationQuery("");
    setActiveLocation("");
  };

  const applyLocationSearch = () => {
    setActiveLocation(locationQuery.trim());
  };

  const clearLocationSearch = () => {
    setLocationQuery("");
    setActiveLocation("");
  };

  const hasActiveFilters =
    !!activeLocation ||
    selectedGenders.length > 0 ||
    !!minAge ||
    !!maxAge;

  const removeTop = useCallback(() => {
    if (targetType === "groups") {
      setGroups((prev) => prev.filter((g) => g.group_id !== (top as TravelGroup | undefined)?.group_id));
    } else {
      setProfiles((prev) => prev.filter((p) => p.user_id !== (top as Profile | undefined)?.user_id));
    }
    setCardImprint(null);
    committingRef.current = false;
  }, [targetType, top]);

  const removeListItem = useCallback(
    (item: Profile | TravelGroup) => {
      const id = "group_id" in item ? item.group_id : item.user_id;
      if (targetType === "groups") {
        setGroups((prev) => prev.filter((g) => g.group_id !== id));
      } else {
        setProfiles((prev) => prev.filter((p) => p.user_id !== id));
      }
      setListExitingId(null);
    },
    [targetType]
  );

  const handleSwipe = useCallback(
    async (direction: "like" | "pass", target: Profile | TravelGroup) => {
      try {
        if (targetType === "groups") {
          const group = target as TravelGroup;
          await api.groupSwipe(group.group_id, direction, mode);
        } else {
          const profile = target as Profile;
          const r = await api.swipe(profile.user_id, direction, mode);
          if (r.matched) {
            setMatchModal(profile);
            setMatchId(r.match_id);
            setMatchShared(r.shared_destinations || profile.shared_destinations || []);
          }
        }
      } catch (e: any) {
        Alert.alert("Error", e.message || "");
      }
    },
    [targetType, mode]
  );

  const commitStamp = useCallback(
    (variant: StampVariant) => {
      if (!top || committingRef.current) return;
      committingRef.current = true;
      const target = top;
      const direction = variant === "accepted" ? "like" : "pass";
      planePath.value = randomPlanePath(
        variant === "accepted",
        viewportWidth,
        viewportHeight
      );
      setPlaneFlightKey((k) => k + 1);
      setCardImprint(variant);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      imprintProgress.value = 0;
      imprintProgress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      exitProgress.value = 0;
      exitProgress.value = withDelay(
        300,
        withTiming(
          1,
          { duration: 1480, easing: Easing.bezier(0.35, 0, 0.2, 1) },
          (done) => {
            if (done) {
              runOnJS(removeTop)();
            }
          }
        )
      );
      handleSwipe(direction, target as Profile | TravelGroup);
    },
    [top, imprintProgress, exitProgress, planePath, removeTop, handleSwipe, viewportWidth, viewportHeight]
  );

  const imprintStyle = useAnimatedStyle(() => {
    const stampIn = interpolate(imprintProgress.value, [0, 1], [0, 0.88]);
    const fadeForFold = interpolate(exitProgress.value, [0, 0.2], [1, 0], Extrapolation.CLAMP);
    return {
      opacity: stampIn * fadeForFold,
      transform: [
        { scale: interpolate(imprintProgress.value, [0, 1], [1.12, 1]) },
      ],
    };
  });

  /** Closest card behind top — rises into place while the top card exits. */
  const nextCardStyle = useAnimatedStyle(() => {
    const p = exitProgress.value;
    const peek = stackPeekSv.value;
    return {
      opacity: interpolate(p, [0, 0.25, 0.7, 1], [0.7, 0.82, 0.95, 1], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(p, [0, 0.75, 1], [0.93, 0.99, 1], Extrapolation.CLAMP) },
        { translateY: interpolate(p, [0, 1], [peek, 0], Extrapolation.CLAMP) },
      ],
    };
  });

  const applyDestSearch = () => {
    setActiveDestination(destinationQuery.trim());
  };
  const clearDestSearch = () => {
    setDestinationQuery("");
    setActiveDestination("");
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]} testID="discover-screen">
      <View
        style={[
          styles.brandZone,
          {
            paddingTop: insets.top + 4,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={[styles.brandAccent, { backgroundColor: colors.primary }]} />
        <View style={styles.header}>
          <Text style={[styles.brand, { color: colors.primary }]}>
            {targetType === "groups" ? copy.discoverGroups : copy.discoverPeople}
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setView(view === "deck" ? "list" : "deck")}
              style={[styles.iconBtn, { backgroundColor: colors.inputBg }]}
              testID="toggle-view-button"
            >
              <Ionicons
                name={view === "deck" ? "list-outline" : icons.listView}
                size={18}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowFilters(true)}
              style={[styles.iconBtn, { backgroundColor: colors.inputBg }]}
              testID="open-filters-button"
            >
              <Ionicons name={icons.filter} size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <AnimatedSegmentedControl
          options={typeOptions}
          value={targetType}
          onChange={setTargetType}
          testIDPrefix="discover-type"
          variant="filled"
          size="md"
          style={styles.typeSwitch}
        />
      </View>

      {targetType === "groups" ? (
        <TouchableOpacity
          style={[styles.createSquadCta, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push("/group/new")}
          testID="create-squad-cta"
        >
          <View style={styles.createSquadCopy}>
            <Text style={[styles.createSquadTitle, { color: colors.textPrimary }]}>{copy.createSquadTitle}</Text>
            <Text style={[styles.createSquadSub, { color: colors.textSecondary }]}>{copy.createSquadSub}</Text>
          </View>
          <View style={[styles.createSquadIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name={icons.createSquad} size={20} color={colors.onPrimary} />
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Destination search */}
      <View style={{ paddingHorizontal: 20, marginTop: 8, zIndex: 20 }}>
        <SuggestInput
          variant="search"
          testID="destination-search-input"
          value={destinationQuery}
          onChangeText={setDestinationQuery}
          onPick={(v) => {
            setDestinationQuery(v);
            setActiveDestination(v);
          }}
          placeholder="City, festival, or event — e.g. Tokyo, Coachella"
          trailingChild={
            activeDestination ? (
              <TouchableOpacity onPress={clearDestSearch} testID="clear-destination-button">
                <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ) : null
          }
          rightAction={
            !activeDestination && destinationQuery
              ? { label: "Search", onPress: applyDestSearch, testID: "apply-destination-button" }
              : undefined
          }
        />
      </View>

      <AnimatedSegmentedControl
        options={modeOptions}
        value={mode}
        onChange={setMode}
        testIDPrefix="mode-tab"
        variant="soft"
        size="sm"
        style={styles.modeRow}
      />

      {(activeDestination || hasActiveFilters) ? (
        <View style={styles.activeFilterRow}>
          {activeDestination ? (
            <View style={[styles.activeFilterPill, { backgroundColor: colors.primary }]}>
              <Ionicons name="airplane" size={12} color={colors.onPrimary} />
              <Text style={[styles.activeFilterText, { color: colors.onPrimary }]}>
                Going: {activeDestination}
              </Text>
            </View>
          ) : null}
          {activeLocation ? (
            <View style={[styles.activeFilterPill, { backgroundColor: colors.primary }]}>
              <Ionicons name="location" size={12} color={colors.onPrimary} />
              <Text style={[styles.activeFilterText, { color: colors.onPrimary }]}>
                Based in: {activeLocation}
              </Text>
            </View>
          ) : null}
          {targetType === "people" && selectedGenders.map((g) => {
            const label = DISCOVER_GENDER_FILTERS.find((f) => f.key === g)?.label ?? g;
            return (
              <View key={g} style={[styles.activeFilterPill, { backgroundColor: colors.primary }]}>
                <Text style={[styles.activeFilterText, { color: colors.onPrimary }]}>{label}</Text>
              </View>
            );
          })}
          {targetType === "people" && (minAge || maxAge) ? (
            <View style={[styles.activeFilterPill, { backgroundColor: colors.primary }]}>
              <Text style={[styles.activeFilterText, { color: colors.onPrimary }]}>
                Age {minAge || "18"}–{maxAge || "99"}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (targetType === "groups" ? groups.length === 0 : profiles.length === 0) ? (
        <View style={styles.center}>
          {isVinci ? <VinciVectorSketches layout="compact" /> : null}
          <Ionicons name={isVinci ? "brush-outline" : "search-outline"} size={36} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            {targetType === "groups"
              ? (activeDestination ? "No squads here yet" : "No more squads")
              : (activeDestination ? "Nobody here yet" : "You're all caught up")}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {activeDestination || hasActiveFilters
              ? `Try different filters or switch modes.`
              : `Check back later, or try another mode.`}
          </Text>
          <TouchableOpacity style={[styles.reloadBtn, { backgroundColor: colors.primary }]} onPress={load} testID="reload-button">
            <Text style={{ color: colors.onPrimary, fontWeight: "700" }}>Reload</Text>
          </TouchableOpacity>
          {targetType === "groups" ? (
            <TouchableOpacity
              style={[styles.reloadBtn, styles.createEmptyBtn, { backgroundColor: colors.chipBg }]}
              onPress={() => router.push("/group/new")}
              testID="create-squad-empty-button"
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>{copy.createSquadBtn}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : view === "deck" ? (
        <View style={styles.deck}>
          {[...stackBehind].reverse().map((item, revIdx) => {
            const depth = stackBehind.length - 1 - revIdx;
            const isNext = depth === 0;
            const id = "group_id" in item ? item.group_id : item.user_id;
            const card =
              targetType === "groups" ? (
                <GroupCard
                  group={item as TravelGroup}
                  stacked={!isNext}
                  stackDepth={depth}
                  stackPeekBase={stackPeekBase}
                />
              ) : (
                <MinimalCard
                  profile={item as Profile}
                  stacked={!isNext}
                  stackDepth={depth}
                  stackPeekBase={stackPeekBase}
                />
              );
            return (
              <View key={id} style={styles.cardWrap} pointerEvents="none">
                {isNext ? (
                  <Animated.View style={[styles.cardStackLayer, nextCardStyle]}>{card}</Animated.View>
                ) : (
                  <View style={styles.cardStackLayer}>{card}</View>
                )}
              </View>
            );
          })}
          {top && (
            <View style={styles.cardWrap}>
              {cardImprint ? (
                <>
                  <BoardingPassFoldExit progress={exitProgress} height={cardHeight}>
                    <View
                      style={styles.cardMeasure}
                      onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
                    >
                      {targetType === "groups" ? (
                        <GroupCard group={top as TravelGroup} highlight={activeDestination} />
                      ) : (
                        <MinimalCard profile={top as Profile} highlight={activeDestination} />
                      )}
                      <Animated.View style={[styles.imprintSlot, imprintStyle]} pointerEvents="none">
                        <RubberStamp
                          variant={cardImprint}
                          size="imprint"
                          palette={stampPalette}
                          preset={preset}
                        />
                      </Animated.View>
                    </View>
                  </BoardingPassFoldExit>
                  <FlyingPlaneExit
                    key={planeFlightKey}
                    progress={exitProgress}
                    path={planePath}
                    color={cardImprint === "accepted" ? colors.success : colors.error}
                  />
                </>
              ) : (
                <View
                  style={styles.cardMeasure}
                  onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
                >
                  {targetType === "groups" ? (
                    <GroupCard group={top as TravelGroup} highlight={activeDestination} />
                  ) : (
                    <MinimalCard profile={top as Profile} highlight={activeDestination} />
                  )}
                </View>
              )}
            </View>
          )}
          <View style={[styles.stampDock, { paddingBottom: 16 + insets.bottom }]}>
            <DraggableRubberStamp
              variant="rejected"
              palette={stampPalette}
              preset={preset}
              disabled={!!cardImprint}
              onStamp={() => commitStamp("rejected")}
              testID="pass-button"
            />
            <DraggableRubberStamp
              variant="accepted"
              palette={stampPalette}
              preset={preset}
              disabled={!!cardImprint}
              onStamp={() => commitStamp("accepted")}
              testID="like-button"
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={targetType === "groups" ? groups : profiles}
          keyExtractor={(it: any) => it.group_id || it.user_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          scrollEnabled={!listExitingId}
          renderItem={({ item }: any) => {
            const isGroup = !!item.group_id;
            const rowId = item.group_id || item.user_id;
            return (
              <DiscoverListRow
                item={item}
                isGroup={isGroup}
                colors={colors}
                stampPalette={stampPalette}
                preset={preset}
                goIcon={isGroup ? "person-add" : "arrow-forward"}
                disabled={!!listExitingId && listExitingId !== rowId}
                onGo={(target) => {
                  void handleSwipe("like", target as Profile | TravelGroup);
                }}
                onExitStart={setListExitingId}
                onExitComplete={(target) => removeListItem(target as Profile | TravelGroup)}
              />
            );
          }}
        />
      )}

      <DismissibleBottomSheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        testID="filters-sheet"
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Filters</Text>

            <Text style={styles.label}>Based in (location)</Text>
            <SuggestInput
              variant="filled"
              testID="filter-location-input"
              value={locationQuery}
              onChangeText={setLocationQuery}
              onPick={(v) => {
                setLocationQuery(v);
                setActiveLocation(v);
              }}
              placeholder="City or region — e.g. Berlin, Mumbai"
              trailingChild={
                activeLocation ? (
                  <TouchableOpacity onPress={clearLocationSearch} testID="clear-location-filter">
                    <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                ) : null
              }
              rightAction={
                !activeLocation && locationQuery
                  ? { label: "Apply", onPress: applyLocationSearch, testID: "apply-location-filter" }
                  : undefined
              }
            />

            {targetType === "people" ? (
              <>
            <Text style={styles.label}>Show me</Text>
            <View style={styles.genderChipRow}>
              {DISCOVER_GENDER_FILTERS.map((g) => {
                const active = selectedGenders.includes(g.key);
                return (
                  <TouchableOpacity
                    key={g.key}
                    testID={`filter-gender-${g.key}`}
                    onPress={() => toggleGender(g.key)}
                    style={[styles.genderChip, active && styles.genderChipActive]}
                  >
                    <Text style={[styles.genderChipText, active && styles.genderChipTextActive]}>
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Age range</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TextInput
                testID="filter-min-age"
                style={[styles.input, { flex: 1 }]}
                value={minAge}
                onChangeText={setMinAge}
                placeholder="Min"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="number-pad"
              />
              <TextInput
                testID="filter-max-age"
                style={[styles.input, { flex: 1 }]}
                value={maxAge}
                onChangeText={setMaxAge}
                placeholder="Max"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="number-pad"
              />
            </View>
              </>
            ) : (
              <Text style={styles.groupFilterHint}>
                Squads use destination, location and mode filters. More members means higher visibility.
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                style={[styles.sheetBtn, { backgroundColor: "#F3F4F6" }]}
                onPress={clearAllFilters}
                testID="clear-filters-button"
              >
                <Text style={{ fontWeight: "700", color: COLORS.textPrimary }}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, { backgroundColor: COLORS.primary }]}
                onPress={() => {
                  if (locationQuery.trim()) setActiveLocation(locationQuery.trim());
                  setShowFilters(false);
                }}
                testID="apply-filters-button"
              >
                <Text style={{ fontWeight: "700", color: "#fff" }}>Apply</Text>
              </TouchableOpacity>
            </View>
        </View>
      </DismissibleBottomSheet>

      {/* Match modal */}
      <Modal visible={!!matchModal} transparent animationType="fade" onRequestClose={() => setMatchModal(null)}>
        <View style={styles.matchBackdrop}>
          <View style={[styles.matchCard, { backgroundColor: colors.surface }]}>
            {matchModal && (
              <Image
                source={{ uri: matchModal.photos?.[0] || matchModal.picture || undefined }}
                style={styles.matchAvatar}
              />
            )}
            <Text style={[styles.matchTitle, { color: colors.textPrimary }]}>{copy.matchTitle}</Text>
            <Text style={[styles.matchSub, { color: colors.textSecondary }]}>
              {copy.matchSub.replace("{name}", matchModal?.name || "them")}
            </Text>
            {matchShared.length > 0 && (
              <View style={styles.matchSharedPill}>
                <Ionicons name="sparkles" size={12} color="#fff" />
                <Text style={styles.matchSharedText}>
                  You&apos;re both going to {matchShared.slice(0, 2).join(" & ")}
                </Text>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 22, width: "100%" }}>
              <TouchableOpacity
                style={[styles.matchBtn, { backgroundColor: colors.chipBg }]}
                onPress={() => { setMatchModal(null); setMatchId(null); setMatchShared([]); removeTop(); }}
                testID="keep-swiping-button"
              >
                <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{copy.matchKeepExploring}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.matchBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  const id = matchId;
                  setMatchModal(null);
                  setMatchId(null);
                  setMatchShared([]);
                  removeTop();
                  if (id) router.push(`/chat/${id}`);
                }}
                testID="send-message-button"
              >
                <Text style={{ color: colors.onPrimary, fontWeight: "700" }}>{copy.matchSayHi}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** ~23% of pass height visible behind the card above. */
function stackCardStyle(depth: number, peekBase: number) {
  const layerGap = Math.round(peekBase * 0.5);
  return {
    opacity: Math.max(0.4, 0.72 - depth * 0.14),
    transform: [
      { scale: 0.93 - depth * 0.035 },
      { translateY: peekBase + depth * layerGap },
    ] as const,
  };
}

function MinimalCard({
  profile,
  stacked,
  stackDepth = 0,
  stackPeekBase = 66,
  highlight,
}: {
  profile: Profile;
  stacked?: boolean;
  stackDepth?: number;
  stackPeekBase?: number;
  highlight?: string;
}) {
  const photos = profile.photos && profile.photos.length
    ? profile.photos
    : (profile.picture ? [profile.picture] : []);
  const dests = profile.destinations || [];
  const shared = profile.shared_destinations || [];
  const primaryDest = shared[0] || dests[0] || profile.location || "Wherever";
  return (
    <View
      style={[styles.card, stacked && stackCardStyle(stackDepth, stackPeekBase)]}
      testID={`profile-card-${profile.user_id}`}
    >
      {/* Top: destination poster band */}
      <View style={styles.posterBand}>
        <View style={StyleSheet.absoluteFill as any}>
          <PhotoCarousel photos={photos} />
        </View>
        <LinearGradient
          colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.55)"]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFillObject as any}
          pointerEvents="none"
        />
        <View style={styles.posterTopRow} pointerEvents="none">
          <Text style={styles.posterKicker}>HEADED TO</Text>
          {shared.length > 0 && (
            <View style={styles.posterStamp}>
              <Ionicons name="checkmark" size={10} color={COLORS.primary} />
              <Text style={styles.posterStampText}>SAME TRIP</Text>
            </View>
          )}
        </View>
        <View style={styles.posterMain} pointerEvents="none">
          <Text style={styles.posterDest} numberOfLines={2}>
            {primaryDest.toUpperCase()}
          </Text>
          {dests.length > 1 && (
            <Text style={styles.posterAlsoText} numberOfLines={1}>
              + {dests.filter((d) => d !== primaryDest).slice(0, 2).join(" · ")}
            </Text>
          )}
        </View>
      </View>

      {/* Boarding-pass perforated divider */}
      <View style={styles.perforatedRow} pointerEvents="none">
        <View style={[styles.notch, { left: -10 }]} />
        <View style={styles.dashes}>
          {Array.from({ length: 24 }).map((_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
        <View style={[styles.notch, { right: -10 }]} />
      </View>

      {/* Bottom: traveler card */}
      <View style={styles.travelerCard}>
        <View style={styles.travelerRow}>
          <Image
            source={{ uri: photos[0] || undefined }}
            style={styles.travelerAvatar}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.travelerName}>
              {profile.name} <Text style={styles.travelerAge}>· {profile.age}</Text>
            </Text>
            <Text style={styles.travelerLoc}>
              <Ionicons name="location-outline" size={11} color={COLORS.textSecondary} /> Based in {profile.location}
            </Text>
          </View>
          <View style={styles.passNumber}>
            <Text style={styles.passNumberLabel}>NO.</Text>
            <Text style={styles.passNumberText}>{profile.user_id.slice(-4).toUpperCase()}</Text>
          </View>
        </View>
        {!!profile.bio && (
          <Text style={styles.travelerBio} numberOfLines={2}>
            {profile.bio}
          </Text>
        )}
        {!!profile.interests?.length && (
          <View style={styles.travelerTags}>
            {profile.interests.slice(0, 4).map((t) => (
              <View key={t} style={styles.travelerTag}>
                <Text style={styles.travelerTagText}>{t}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function GroupCard({
  group,
  stacked,
  stackDepth = 0,
  stackPeekBase = 66,
  highlight,
}: {
  group: TravelGroup;
  stacked?: boolean;
  stackDepth?: number;
  stackPeekBase?: number;
  highlight?: string;
}) {
  const photos = group.photos && group.photos.length ? group.photos : [];
  const primaryDest = group.destinations?.[0] || group.location || "Somewhere";
  return (
    <View
      style={[styles.card, stacked && stackCardStyle(stackDepth, stackPeekBase)]}
      testID={`group-card-${group.group_id}`}
    >
      <View style={styles.posterBand}>
        <View style={StyleSheet.absoluteFill as any}>
          <PhotoCarousel photos={photos} />
        </View>
        <LinearGradient
          colors={["rgba(0,0,0,0.65)", "rgba(0,0,0,0.2)", "rgba(0,0,0,0.72)"]}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFillObject as any}
          pointerEvents="none"
        />
        <View style={styles.posterTopRow} pointerEvents="none">
          <Text style={styles.posterKicker}>SQUAD HEADED TO</Text>
          <View style={styles.posterStamp}>
            <Ionicons name="trending-up" size={10} color={COLORS.primary} />
            <Text style={styles.posterStampText}>{group.member_count}/{group.max_members}</Text>
          </View>
        </View>
        <View style={styles.posterMain} pointerEvents="none">
          <Text style={styles.posterDest} numberOfLines={2}>
            {primaryDest.toUpperCase()}
          </Text>
          {!!highlight && (
            <Text style={styles.posterAlsoText} numberOfLines={1}>
              Matching {highlight}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.perforatedRow} pointerEvents="none">
        <View style={[styles.notch, { left: -10 }]} />
        <View style={styles.dashes}>
          {Array.from({ length: 24 }).map((_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
        <View style={[styles.notch, { right: -10 }]} />
      </View>

      <View style={styles.travelerCard}>
        <View style={styles.travelerRow}>
          <View style={styles.groupAvatarStack}>
            {(group.members || []).slice(0, 3).map((m, idx) => (
              <Image
                key={m.user_id}
                source={{ uri: m.picture || undefined }}
                style={[styles.groupAvatar, { left: idx * 20 }]}
              />
            ))}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.travelerName}>
              {group.name}
            </Text>
            <Text style={styles.travelerLoc}>
              <Ionicons name="people-outline" size={11} color={COLORS.textSecondary} /> {group.member_count} travelers · {group.location}
            </Text>
          </View>
          <View style={styles.passNumber}>
            <Text style={styles.passNumberLabel}>VIS</Text>
            <Text style={styles.passNumberText}>{Math.round(group.visibility_score || 0)}</Text>
          </View>
        </View>
        {!!group.bio && (
          <Text style={styles.travelerBio} numberOfLines={2}>
            {group.bio}
          </Text>
        )}
        {!!group.destinations?.length && (
          <View style={styles.travelerTags}>
            {group.destinations.slice(0, 4).map((t) => (
              <View key={t} style={styles.travelerTag}>
                <Text style={styles.travelerTagText}>{t}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  brandZone: {
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandAccent: {
    height: 3,
    marginHorizontal: 20,
    borderRadius: 2,
    marginBottom: 10,
  },

  // Header
  header: {
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  brand: { fontSize: 28, fontWeight: "800", letterSpacing: -0.4 },
  headerActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#F7F7F7",
    alignItems: "center", justifyContent: "center",
  },
  typeSwitch: {
    marginHorizontal: 20,
    marginTop: 4,
  },
  createSquadCta: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  createSquadTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: "900" },
  createSquadSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3, lineHeight: 16 },
  createSquadCopy: { flex: 1, minWidth: 0 },
  createSquadIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // Search
  searchBox: {
    marginHorizontal: 20, marginTop: 8,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F7F7F7", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.textPrimary, padding: 0 },

  modeRow: {
    marginHorizontal: 20,
    marginTop: 12,
  },

  activeFilterRow: {
    paddingHorizontal: 20, marginTop: 12,
    flexDirection: "row", flexWrap: "wrap", gap: 8,
  },
  activeFilterPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  genderChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genderChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
    backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border,
  },
  genderChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  genderChipText: { fontSize: 13, fontWeight: "600", color: COLORS.textPrimary },
  genderChipTextActive: { color: COLORS.onPrimary },
  activeFilterText: { fontSize: 12, fontWeight: "700", color: COLORS.onPrimary },

  // Deck (rubber stamps)
  deck: { flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, overflow: "visible" },
  cardWrap: {
    ...StyleSheet.absoluteFillObject,
    left: 20,
    right: 20,
    top: 16,
    bottom: 118,
    overflow: "visible",
  },
  cardStackLayer: { flex: 1 },
  cardMeasure: { flex: 1 },
  imprintSlot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  stampDock: {
    position: "absolute",
    left: 32,
    right: 32,
    bottom: 26,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 48,
    zIndex: 40,
  },
  card: {
    flex: 1,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  // Poster band (top half) - destination as headline
  posterBand: { flex: 1.05, backgroundColor: "#2a241c", overflow: "hidden" },
  posterTopRow: {
    position: "absolute", top: 16, left: 18, right: 18,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  posterKicker: {
    color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "800",
    letterSpacing: 2.4,
  },
  posterStamp: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.accent, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 4, transform: [{ rotate: "-6deg" }],
  },
  posterStampText: { color: COLORS.textPrimary, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  posterMain: {
    position: "absolute", left: 18, right: 18, bottom: 16,
  },
  posterDest: {
    color: "#fff", fontSize: 36, fontWeight: "900",
    letterSpacing: -0.8, lineHeight: 38,
  },
  posterAlsoText: {
    color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 4,
    fontWeight: "600", letterSpacing: 0.3,
  },
  // Perforated divider (boarding pass)
  perforatedRow: {
    height: 18, backgroundColor: COLORS.surface,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    position: "relative", marginHorizontal: 0,
  },
  notch: {
    position: "absolute", width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.bg, top: -1,
  },
  dashes: { flexDirection: "row", flex: 1, paddingHorizontal: 14, gap: 4 },
  dash: { flex: 1, height: 1.5, backgroundColor: COLORS.border, borderRadius: 1 },
  // Traveler card (bottom half)
  travelerCard: {
    paddingHorizontal: 18, paddingTop: 2, paddingBottom: 18,
    backgroundColor: COLORS.surface,
  },
  travelerRow: { flexDirection: "row", alignItems: "center" },
  travelerAvatar: {
    width: 52, height: 52, borderRadius: 10,
    backgroundColor: COLORS.chipBg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  groupAvatarStack: { width: 94, height: 52, position: "relative" },
  groupAvatar: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.chipBg,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  travelerName: { fontSize: 18, fontWeight: "800", color: COLORS.textPrimary, letterSpacing: -0.3 },
  travelerAge: { fontWeight: "500", color: COLORS.textSecondary },
  travelerLoc: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontWeight: "600" },
  passNumber: { alignItems: "flex-end" },
  passNumberLabel: { fontSize: 8, color: COLORS.textSecondary, fontWeight: "800", letterSpacing: 1.5 },
  passNumberText: {
    fontSize: 14, color: COLORS.textPrimary, fontWeight: "800",
    letterSpacing: 1, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  travelerBio: { fontSize: 13, color: COLORS.textPrimary, lineHeight: 18, marginTop: 12 },
  travelerTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  travelerTag: {
    backgroundColor: COLORS.chipBg, paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 6,
  },
  travelerTagText: { fontSize: 11, fontWeight: "700", color: COLORS.textPrimary, letterSpacing: 0.2 },
  cardImg: { ...StyleSheet.absoluteFillObject as any, width: "100%", height: "100%" },
  tint: { ...StyleSheet.absoluteFillObject as any },
  sharedBanner: {
    position: "absolute", top: 20, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    shadowColor: "#000", shadowOpacity: 0.18, shadowOffset: { width: 0, height: 6 }, shadowRadius: 12,
    elevation: 6,
  },
  sharedBannerText: { fontSize: 12, fontWeight: "800", color: "#111", letterSpacing: 0.2, maxWidth: 220 },
  cardOverlay: { position: "absolute", left: 22, right: 22, bottom: 22 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  metaText: { color: "rgba(255,255,255,0.95)", fontSize: 12, fontWeight: "500" },
  cardName: { color: "#fff", fontSize: 30, fontWeight: "800", letterSpacing: -0.6 },
  cardAge: { fontWeight: "400", fontSize: 26 },
  cardBio: { color: "rgba(255,255,255,0.92)", marginTop: 10, fontSize: 14, lineHeight: 19 },
  destRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  destTag: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  destTagActive: { backgroundColor: "#fff" },
  destTagText: { color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },

  // Empty / loading
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary, marginTop: 12 },
  emptySubtitle: { color: COLORS.textSecondary, textAlign: "center", marginTop: 6, marginBottom: 16, fontSize: 13 },
  reloadBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 999 },
  createEmptyBtn: { backgroundColor: COLORS.chipBg, marginTop: 10 },

  // List view
  listCard: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 16, padding: 12,
    marginBottom: 10, alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  listThumb: { width: 66, height: 84, borderRadius: 12, marginRight: 12, backgroundColor: "#eee" },
  listName: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },
  listLoc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  listGoing: { fontSize: 12, color: COLORS.primary, marginTop: 4, fontWeight: "600" },
  listBio: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  listLikeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },

  // Filters sheet
  sheet: { backgroundColor: "#fff", padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 14 },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary, marginTop: 8, marginBottom: 8 },
  input: { backgroundColor: "#F7F7F7", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.textPrimary },
  sheetBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 999 },
  groupFilterHint: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 8 },

  // Match modal
  matchBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 },
  matchCard: {
    backgroundColor: "#fff", borderRadius: 24, padding: 28, width: "100%",
    alignItems: "center",
  },
  matchAvatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#eee", marginBottom: 18 },
  matchTitle: { fontSize: 24, fontWeight: "800", color: COLORS.textPrimary, letterSpacing: -0.4 },
  matchSub: { color: COLORS.textSecondary, fontSize: 14, marginTop: 6, textAlign: "center" },
  matchSharedPill: {
    marginTop: 14,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
  },
  matchSharedText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  matchBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 999 },
});
