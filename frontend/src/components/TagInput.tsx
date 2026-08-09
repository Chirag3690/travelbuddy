import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/src/lib/api";
import { useTheme } from "@/src/lib/theme";

type Props = {
  tags: string[];
  onChangeTags: (tags: string[]) => void;
  placeholder?: string;
  testID?: string;
  maxTags?: number;
  fetchSuggestions: (q: string) => Promise<string[]>;
  icon?: keyof typeof Ionicons.glyphMap;
};

export default function TagInput({
  tags,
  onChangeTags,
  placeholder = "Type and add…",
  testID,
  maxTags = 12,
  fetchSuggestions,
  icon = "pricetag-outline",
}: Props) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetchSuggestions(draft);
        setItems(
          (data || []).filter(
            (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase())
          )
        );
        setOpen(true);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft, tags, fetchSuggestions]);

  const addTag = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (tags.length >= maxTags) return;
    if (tags.some((t) => t.toLowerCase() === v.toLowerCase())) return;
    onChangeTags([...tags, v]);
    setDraft("");
    setOpen(false);
  };

  return (
    <View>
      <View style={[styles.box, { backgroundColor: colors.inputBg }]}>
        <TextInput
          testID={testID}
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.textPrimary }]}
          onFocus={() => {
            focused.current = true;
            setOpen(true);
          }}
          onBlur={() => {
            focused.current = false;
            setTimeout(() => setOpen(false), 160);
          }}
          onSubmitEditing={() => addTag(draft)}
          returnKeyType="done"
        />
        <TouchableOpacity
          onPress={() => addTag(draft)}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          testID={testID ? `${testID}-add` : undefined}
        >
          <Ionicons name="add" size={20} color={colors.bg} />
        </TouchableOpacity>
      </View>

      {open && (loading || items.length > 0) && (
        <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {loading ? (
            <View style={styles.row}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
            </View>
          ) : (
            items.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.row, { borderBottomColor: colors.border }]}
                onPress={() => addTag(s)}
                testID={testID ? `${testID}-suggestion-${s}` : undefined}
              >
                <Ionicons name={icon} size={14} color={colors.textSecondary} />
                <Text style={[styles.rowText, { color: colors.textPrimary }]}>{s}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {tags.length > 0 && (
        <View style={styles.tagsRow}>
          {tags.map((t) => (
            <View key={t} style={[styles.tag, { backgroundColor: colors.chipBg }]}>
              <Text style={[styles.tagText, { color: colors.textPrimary }]}>{t}</Text>
              <TouchableOpacity
                onPress={() => onChangeTags(tags.filter((x) => x !== t))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F7F7F7",
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: { flex: 1, fontSize: 16, color: COLORS.textPrimary, paddingVertical: 8 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdown: {
    marginTop: 6,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: "500" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagText: { fontSize: 13, fontWeight: "600", color: COLORS.textPrimary },
});
