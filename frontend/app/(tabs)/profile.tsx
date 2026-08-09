import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api, COLORS } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import ProfilePhotoGallery, { GALLERY_H } from "@/src/components/ProfilePhotoGallery";
import { getModes, useTheme } from "@/src/lib/theme";

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: colors.chipBg }]}>
          <Ionicons name={icon} size={16} color={colors.primary} />
        </View>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { colors, preset, isNight, isVinci, toggleMode, togglePreset } = useTheme();
  const modeLabel = Object.fromEntries(getModes(preset).map((m) => [m.key, m.label]));
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingVisibility, setSavingVisibility] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await api.myProfile();
      setProfile(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleHideFromDiscover = async () => {
    if (!profile || savingVisibility) return;
    const next = !profile.hide_from_discover;
    setProfile((prev: any) => (prev ? { ...prev, hide_from_discover: next } : prev));
    setSavingVisibility(true);
    try {
      const updated = await api.updateProfileSettings({ hide_from_discover: next });
      setProfile(updated);
    } catch {
      setProfile((prev: any) => (prev ? { ...prev, hide_from_discover: !next } : prev));
    } finally {
      setSavingVisibility(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const photos: string[] =
    profile?.photos?.length > 0
      ? profile.photos
      : user?.picture
        ? [user.picture]
        : [];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]} testID="profile-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
      >
        <ProfilePhotoGallery photos={photos} topInset={insets.top} />

        <View style={[styles.identityBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.name, { color: colors.textPrimary }]}>
            {profile?.name || user?.name}
            {profile?.age ? (
              <Text style={[styles.age, { color: colors.textSecondary }]}>, {profile.age}</Text>
            ) : null}
          </Text>
          {profile?.location ? (
            <View style={styles.locRow}>
              <Ionicons name="location" size={15} color={colors.primary} />
              <Text style={[styles.location, { color: colors.textPrimary }]}>{profile.location}</Text>
            </View>
          ) : null}
          {profile?.gender ? (
            <Text style={[styles.metaLine, { color: colors.textSecondary }]}>{profile.gender}</Text>
          ) : null}
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={[styles.themeToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={togglePreset}
            testID="design-preset-toggle-button"
          >
            <View style={styles.themeToggleLeft}>
              <View style={[styles.themeIcon, { backgroundColor: colors.chipBg }]}>
                <Ionicons name={isVinci ? "color-palette" : "color-palette-outline"} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.themeTitle, { color: colors.textPrimary }]}>Atelier style</Text>
                <Text style={[styles.themeSub, { color: colors.textSecondary }]}>
                  {isVinci
                    ? "Atlantis abyss, floating Da Vinci sketches, bioluminescent colors & themed icons."
                    : "Switch to the Leonardo atelier look with animated sketches and Atlantis-style colors."}
                </Text>
              </View>
            </View>
            <View style={[styles.switchTrack, isVinci && { backgroundColor: colors.primary }]}>
              <View style={[styles.switchKnob, isVinci && styles.switchKnobOn]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.themeToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={toggleMode}
            testID="theme-toggle-button"
          >
            <View style={styles.themeToggleLeft}>
              <View style={[styles.themeIcon, { backgroundColor: colors.chipBg }]}>
                <Ionicons name={isNight ? "moon" : "sunny"} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.themeTitle, { color: colors.textPrimary }]}>Night mode</Text>
                <Text style={[styles.themeSub, { color: colors.textSecondary }]}>
                  {isNight ? "Premium dark colors enabled" : "Switch to a premium dark theme"}
                </Text>
              </View>
            </View>
            <View style={[styles.switchTrack, isNight && { backgroundColor: colors.primary }]}>
              <View style={[styles.switchKnob, isNight && styles.switchKnobOn]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.themeToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={toggleHideFromDiscover}
            disabled={savingVisibility}
            testID="hide-from-discover-toggle"
          >
            <View style={styles.themeToggleLeft}>
              <View style={[styles.themeIcon, { backgroundColor: colors.chipBg }]}>
                <Ionicons
                  name={profile?.hide_from_discover ? "eye-off" : "eye-outline"}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.themeTitle, { color: colors.textPrimary }]}>Hide from discover</Text>
                <Text style={[styles.themeSub, { color: colors.textSecondary }]}>
                  {profile?.hide_from_discover
                    ? "Your profile is hidden — new people won't see you in Find."
                    : "Trip done? Turn this on to stay off the radar after you've traveled."}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.switchTrack,
                profile?.hide_from_discover && { backgroundColor: colors.primary },
              ]}
            >
              <View
                style={[
                  styles.switchKnob,
                  profile?.hide_from_discover && styles.switchKnobOn,
                ]}
              />
            </View>
          </TouchableOpacity>

          {profile?.bio ? (
            <SectionCard title="About" icon="document-text-outline">
              <Text style={[styles.bio, { color: colors.textPrimary }]}>{profile.bio}</Text>
            </SectionCard>
          ) : null}

          {profile?.destinations?.length > 0 && (
            <SectionCard title="Going to" icon="airplane-outline">
              <View style={styles.chipRow}>
                {profile.destinations.map((d: string) => (
                  <View key={d} style={[styles.chip, styles.chipDark]}>
                    <Ionicons name="navigate" size={12} color="#fff" />
                    <Text style={[styles.chipText, styles.chipTextLight]}>{d}</Text>
                  </View>
                ))}
              </View>
            </SectionCard>
          )}

          {profile?.modes?.length > 0 && (
            <SectionCard title="Here for" icon="compass-outline">
              <View style={styles.chipRow}>
                {profile.modes.map((m: string) => (
                  <View key={m} style={[styles.chip, styles.chipPrimary]}>
                    <Text style={[styles.chipText, styles.chipTextLight]}>
                      {modeLabel[m] || m}
                    </Text>
                  </View>
                ))}
              </View>
            </SectionCard>
          )}

          {profile?.interests?.length > 0 && (
            <SectionCard title="Interests" icon="heart-outline">
              <View style={styles.chipRow}>
                {profile.interests.map((i: string) => (
                  <View key={i} style={[styles.chip, { backgroundColor: colors.chipBg }]}>
                    <Text style={[styles.chipText, { color: colors.textPrimary }]}>{i}</Text>
                  </View>
                ))}
              </View>
            </SectionCard>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/onboarding")}
            testID="edit-profile-button"
            activeOpacity={0.88}
          >
            <Ionicons name="create-outline" size={20} color="#fff" />
            <Text style={[styles.primaryBtnText, { color: colors.onPrimary }]}>Edit profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={async () => {
              await signOut();
              router.replace("/login");
            }}
            testID="logout-button"
            activeOpacity={0.88}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={[styles.secondaryBtnText, { color: colors.error }]}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SafeAreaView style={styles.topBar} edges={["top"]} pointerEvents="box-none">
        <LinearGradient
          colors={["rgba(0,0,0,0.5)", "transparent"]}
          style={styles.topBarGradient}
          pointerEvents="none"
        />
        <Text style={styles.topBarTitle}>My profile</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  centered: { alignItems: "center", justifyContent: "center" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topBarGradient: {
    ...StyleSheet.absoluteFillObject,
    height: GALLERY_H * 0.35,
  },
  topBarTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
    paddingTop: 4,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  identityBlock: {
    marginTop: -28,
    marginHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 4,
  },
  name: {
    fontSize: 26,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  age: { fontWeight: "500", color: COLORS.textSecondary, fontSize: 22 },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  location: { fontSize: 15, color: COLORS.textPrimary, fontWeight: "600" },
  metaLine: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textSecondary,
    textTransform: "capitalize",
    fontWeight: "600",
  },
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
  themeToggle: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  themeToggleLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  themeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  themeTitle: { fontSize: 15, fontWeight: "900" },
  themeSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#D1D5DB",
    padding: 3,
  },
  switchKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
  switchKnobOn: { transform: [{ translateX: 20 }], backgroundColor: "#050506" },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.chipBg,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.textPrimary,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  bio: { fontSize: 16, color: COLORS.textPrimary, lineHeight: 24 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipDark: { backgroundColor: COLORS.primary },
  chipPrimary: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary },
  chipTextLight: { color: "#fff" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 16,
    marginTop: 8,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: { color: COLORS.error, fontSize: 16, fontWeight: "700" },
});
