import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api, COLORS, MODES, ModeKey } from "@/src/lib/api";
import SuggestInput from "@/src/components/SuggestInput";
import { useTheme } from "@/src/lib/theme";

export default function NewGroup() {
  const router = useRouter();
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [mode, setMode] = useState<ModeKey>("trips");
  const [location, setLocation] = useState("");
  const [destInput, setDestInput] = useState("");
  const [destinations, setDestinations] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [maxMembers, setMaxMembers] = useState("6");
  const [saving, setSaving] = useState(false);

  const addDestination = (raw = destInput) => {
    const v = raw.trim();
    if (!v) return;
    if (destinations.length >= 8) return Alert.alert("Max 8 destinations");
    if (!destinations.some((d) => d.toLowerCase() === v.toLowerCase())) {
      setDestinations((prev) => [...prev, v]);
    }
    setDestInput("");
  };

  const pickImage = useCallback(async () => {
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 10],
      quality: 0.6,
      base64: true,
      presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
      legacy: Platform.OS === "android",
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
    setPhotos((prev) => [...prev, uri].slice(0, 6));
  }, []);

  const submit = async () => {
    if (!name.trim()) return Alert.alert("Name your squad");
    if (!location.trim()) return Alert.alert("Add a base location");
    if (destinations.length === 0) return Alert.alert("Add at least one destination or event");
    const max = parseInt(maxMembers, 10);
    if (!max || max < 2) return Alert.alert("Group size", "Choose at least 2 members.");
    setSaving(true);
    try {
      const group = await api.createGroup({
        name: name.trim(),
        bio: bio.trim(),
        mode,
        location: location.trim(),
        destinations,
        photos,
        max_members: max,
      });
      router.replace(`/group/${group.group_id}`);
    } catch (e: any) {
      Alert.alert("Could not create group", e.message || "");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={["top", "bottom"]} testID="new-group-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Create squad</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Squad name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Tokyo Street Food Crew"
          placeholderTextColor={COLORS.textSecondary}
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
          testID="group-name-input"
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>What is the vibe?</Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Tell people what kind of group this is..."
          placeholderTextColor={COLORS.textSecondary}
          style={[styles.input, styles.textarea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
          multiline
          testID="group-bio-input"
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Mode</Text>
        <View style={styles.modeRow}>
          {MODES.map((m) => {
            const active = mode === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => setMode(m.key)}
                style={[
                  styles.modeChip,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  active && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.modeText,
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

        <Text style={[styles.label, { color: colors.textSecondary }]}>Based in</Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="City, Country"
          placeholderTextColor={COLORS.textSecondary}
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
          testID="group-location-input"
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Destinations / events</Text>
        <SuggestInput
          value={destInput}
          onChangeText={setDestInput}
          onPick={(v) => addDestination(v)}
          placeholder="e.g. Coachella, Tokyo, Monaco GP"
          rightAction={{ label: "Add", onPress: () => addDestination(), testID: "add-group-destination" }}
          testID="group-destination-input"
        />
        <View style={styles.chips}>
          {destinations.map((d) => (
            <View key={d} style={styles.chip}>
              <Text style={styles.chipText}>{d}</Text>
              <TouchableOpacity onPress={() => setDestinations((prev) => prev.filter((x) => x !== d))}>
                <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Max members</Text>
        <TextInput
          value={maxMembers}
          onChangeText={setMaxMembers}
          keyboardType="number-pad"
          placeholder="6"
          placeholderTextColor={COLORS.textSecondary}
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
          testID="group-max-members-input"
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Photos</Text>
        <View style={styles.photos}>
          {photos.map((p, idx) => (
            <View key={`${p}-${idx}`} style={styles.photoWrap}>
              <Image source={{ uri: p }} style={styles.photo} />
              <TouchableOpacity
                style={styles.removePhoto}
                onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          {photos.length < 6 && (
            <TouchableOpacity style={styles.addPhoto} onPress={pickImage}>
              <Ionicons name="image-outline" size={24} color={COLORS.textSecondary} />
              <Text style={styles.addPhotoText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.submit, { backgroundColor: colors.primary }]} onPress={submit} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.submitText, { color: colors.onPrimary }]}>Create squad</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 18, fontWeight: "900", color: COLORS.textPrimary },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  label: { fontSize: 12, fontWeight: "800", color: COLORS.textSecondary, marginTop: 16, marginBottom: 8, textTransform: "uppercase" },
  input: { backgroundColor: COLORS.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  textarea: { minHeight: 96, textAlignVertical: "top" },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modeChip: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  modeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modeText: { color: COLORS.textPrimary, fontWeight: "700" },
  modeTextActive: { color: "#fff" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.chipBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  chipText: { color: COLORS.textPrimary, fontWeight: "700", fontSize: 13 },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoWrap: { position: "relative" },
  photo: { width: 88, height: 88, borderRadius: 14, backgroundColor: COLORS.chipBg },
  removePhoto: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  addPhoto: { width: 88, height: 88, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface },
  addPhotoText: { color: COLORS.textSecondary, fontWeight: "700", marginTop: 4 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: "rgba(245,241,232,0.95)" },
  submit: { backgroundColor: COLORS.primary, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "900", fontSize: 16 },
});
