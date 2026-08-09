import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { api, COLORS } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import SuggestInput from "@/src/components/SuggestInput";
import TagInput from "@/src/components/TagInput";
import { getModes, useTheme } from "@/src/lib/theme";

const GENDERS = ["female", "male", "non-binary", "other"];

export default function Onboarding() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { colors, preset } = useTheme();
  const modeOptions = getModes(preset);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [modes, setModes] = useState<string[]>(["events", "trips"]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<string[]>([]);
  const [destInput, setDestInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Prefill from existing profile if any
  useEffect(() => {
    (async () => {
      try {
        const p = await api.myProfile();
        if (p?.profile_complete) {
          setAge(String(p.age || ""));
          setGender(p.gender || "");
          setBio(p.bio || "");
          setLocation(p.location || "");
          setInterests(p.interests || []);
          setModes(p.modes || []);
          setPhotos(p.photos || []);
          setDestinations(p.destinations || []);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const toggle = (arr: string[], setArr: (v: string[]) => void, v: string) => {
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const pickImage = useCallback(async () => {
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        if (!perm.canAskAgain) {
          Alert.alert(
            "Photos access blocked",
            "Enable photo access in your device settings to upload images.",
          );
        }
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.6,
      base64: true,
      presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
      legacy: Platform.OS === "android",
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const uri = asset.base64
      ? `data:image/jpeg;base64,${asset.base64}`
      : asset.uri;
    if (photos.length >= 6) {
      Alert.alert("Max 6 photos");
      return;
    }
    setPhotos((prev) => [...prev, uri]);
  }, [photos.length]);

  const removePhoto = (i: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
  };

  const addDestination = () => {
    const v = destInput.trim();
    if (!v) return;
    if (destinations.length >= 8) {
      Alert.alert("Max 8 destinations");
      return;
    }
    if (!destinations.find((d) => d.toLowerCase() === v.toLowerCase())) {
      setDestinations((prev) => [...prev, v]);
    }
    setDestInput("");
  };

  const submit = async () => {
    const ageNum = parseInt(age, 10);
    if (!ageNum || ageNum < 18) return Alert.alert("Age", "Please enter a valid age (18+).");
    if (!gender) return Alert.alert("Pick a gender");
    if (!location.trim()) return Alert.alert("Add your location");
    if (modes.length === 0) return Alert.alert("Pick at least one mode");
    if (photos.length === 0) return Alert.alert("Add at least one photo");
    setSaving(true);
    try {
      await api.saveProfile({
        age: ageNum,
        gender,
        bio: bio.trim(),
        location: location.trim(),
        interests,
        modes,
        photos,
        destinations,
      });
      await refresh();
      router.replace("/(tabs)/discover");
    } catch (e: any) {
      Alert.alert("Could not save", e.message || "Try again");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={["top", "bottom"]} testID="onboarding-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} testID="onboarding-back-button">
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Your profile</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Photos */}
          <Section title="Photos" subtitle="Add up to 6 photos. The first one is your main.">
            <View style={styles.photoGrid}>
              {photos.map((p, i) => (
                <View key={`${p.slice(0, 30)}-${i}`} style={styles.photoTile}>
                  <Image source={{ uri: p }} style={styles.photoImg} />
                  {i === 0 && (
                    <View style={styles.mainBadge}>
                      <Text style={styles.mainBadgeText}>Main</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => removePhoto(i)}
                    style={styles.removeBtn}
                    testID={`remove-photo-${i}`}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 6 && (
                <TouchableOpacity
                  onPress={pickImage}
                  style={[styles.photoTile, styles.photoAdd, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  testID="add-photo-button"
                >
                  <Ionicons name="add" size={32} color={colors.textSecondary} />
                  <Text style={[styles.photoAddText, { color: colors.textSecondary }]}>Upload</Text>
                </TouchableOpacity>
              )}
            </View>
          </Section>

          {/* Basics */}
          <Section title="Basics">
            <Field label="Age">
              <TextInput
                testID="age-input"
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.textPrimary }]}
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                placeholder="24"
                placeholderTextColor={colors.textSecondary}
              />
            </Field>
            <Field label="I am">
              <View style={styles.chipsRow}>
                {GENDERS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    testID={`gender-${g}`}
                    onPress={() => setGender(g)}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.chipBg },
                      gender === g && { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: colors.textPrimary },
                        gender === g && { color: colors.onPrimary },
                      ]}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>
            <Field label="Based in">
              <TextInput
                testID="location-input"
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.textPrimary }]}
                value={location}
                onChangeText={setLocation}
                placeholder="City, Country"
                placeholderTextColor={colors.textSecondary}
              />
            </Field>
          </Section>

          {/* Bio */}
          <Section title="About you">
            <TextInput
              testID="bio-input"
              style={[styles.input, { minHeight: 110, textAlignVertical: "top", backgroundColor: colors.inputBg, color: colors.textPrimary }]}
              value={bio}
              onChangeText={setBio}
              placeholder="A short blurb about your vibe..."
              placeholderTextColor={colors.textSecondary}
              multiline
            />
          </Section>

          {/* Modes */}
          <Section title="I'm here for" subtitle="Pick one or more.">
            <View style={styles.modesGrid}>
              {modeOptions.map((m) => {
                const active = modes.includes(m.key);
                return (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => toggle(modes, setModes, m.key)}
                    style={[
                      styles.modeTile,
                      { backgroundColor: colors.inputBg },
                      active && { backgroundColor: colors.primary },
                    ]}
                    testID={`mode-${m.key}`}
                  >
                    <Ionicons
                      name={m.icon as any}
                      size={18}
                      color={active ? colors.onPrimary : colors.textPrimary}
                    />
                    <Text
                      style={[
                        styles.modeLabel,
                        { color: colors.textPrimary },
                        active && { color: colors.onPrimary },
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* Destinations */}
          <Section title="Where I'm going" subtitle="Add events / cities so others can find you.">
            <SuggestInput
              testID="destination-input"
              value={destInput}
              onChangeText={setDestInput}
              onPick={(v) => {
                if (destinations.length >= 8) return;
                if (!destinations.find((d) => d.toLowerCase() === v.toLowerCase())) {
                  setDestinations((prev) => [...prev, v]);
                }
                setDestInput("");
              }}
              placeholder="e.g. Coachella, Tokyo"
              rightAction={{
                label: "Add",
                onPress: addDestination,
                testID: "add-destination-button",
              }}
            />
            {destinations.length > 0 && (
              <View style={[styles.chipsRow, { marginTop: 12 }]}>
                {destinations.map((d) => (
                  <View key={d} style={[styles.chip, styles.destChip, { backgroundColor: colors.chipBg }]}>
                    <Ionicons name="location" size={12} color={colors.textPrimary} />
                    <Text style={[styles.chipText, { marginLeft: 4, color: colors.textPrimary }]}>{d}</Text>
                    <TouchableOpacity
                      onPress={() => setDestinations((p) => p.filter((x) => x !== d))}
                      style={{ marginLeft: 6 }}
                      testID={`remove-destination-${d}`}
                    >
                      <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </Section>

          {/* Interests */}
          <Section
            title="Interests"
            subtitle="Type your own — we'll suggest popular ones as you go."
          >
            <TagInput
              testID="interests-input"
              tags={interests}
              onChangeTags={setInterests}
              placeholder="e.g. hiking, techno, street food"
              maxTags={10}
              fetchSuggestions={(q) => api.interestSuggestions(q, 8)}
              icon="heart-outline"
            />
          </Section>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.7 }]}
            onPress={submit}
            disabled={saving}
            testID="save-profile-button"
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.submitText, { color: colors.onPrimary }]}>Save & continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 28 }}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      {subtitle && <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>{subtitle}</Text>}
      <View style={{ marginTop: 14 }}>{children}</View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },
  sectionTitle: { fontSize: 22, fontWeight: "800", color: COLORS.textPrimary, letterSpacing: -0.4 },
  sectionSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: "#F7F7F7",
    borderWidth: 0,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  addBtn: {
    width: 50, height: 50, borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },

  chipsRow: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  chipTextActive: { color: "#fff" },
  destChip: { paddingRight: 8 },

  modesGrid: { flexDirection: "row", gap: 10 },
  modeTile: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: "#F7F7F7",
    alignItems: "center",
    gap: 6,
  },
  modeTileActive: { backgroundColor: COLORS.primary },
  modeLabel: { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary },

  // Photos
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoTile: {
    width: "31%",
    aspectRatio: 0.78,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    position: "relative",
  },
  photoImg: { width: "100%", height: "100%" },
  photoAdd: {
    borderStyle: "dashed", borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center", backgroundColor: "#fff",
  },
  photoAddText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "600", marginTop: 4 },
  mainBadge: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: "#fff", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  mainBadgeText: { fontSize: 10, fontWeight: "800", color: COLORS.textPrimary, letterSpacing: 0.4 },
  removeBtn: {
    position: "absolute", top: 8, right: 8,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center",
  },

  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    padding: 20, backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
  },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 999,
    paddingVertical: 16, alignItems: "center",
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
