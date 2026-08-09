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
import { api, COLORS } from "@/src/lib/api";
import { useTheme } from "@/src/lib/theme";

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  onPick: (v: string) => void;
  placeholder?: string;
  testID?: string;
  rightAction?: { label: string; onPress: () => void; testID?: string };
  variant?: "filled" | "search";
  trailingChild?: React.ReactNode;
};

export default function SuggestInput({
  value,
  onChangeText,
  onPick,
  placeholder,
  testID,
  rightAction,
  variant = "filled",
  trailingChild,
}: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const timer = useRef<any>(null);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.suggestions(value, 8);
        setItems(data || []);
        setOpen(true);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => timer.current && clearTimeout(timer.current);
  }, [value]);

  const handleFocus = async () => {
    focused.current = true;
    setOpen(true);
    if (items.length === 0) {
      setLoading(true);
      try {
        const data = await api.suggestions(value, 8);
        setItems(data || []);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBlur = () => {
    focused.current = false;
    setTimeout(() => setOpen(false), 150);
  };

  const pick = (s: string) => {
    onPick(s);
    setOpen(false);
  };

  const inputStyle = variant === "search" ? styles.searchInput : styles.filledInput;

  return (
    <View style={{ position: "relative" }}>
      <View style={[
        variant === "search" ? styles.searchBox : styles.filledBox,
        { backgroundColor: colors.inputBg, borderColor: colors.border },
      ]}>
        {variant === "search" && (
          <Ionicons name="search" size={16} color={colors.textSecondary} />
        )}
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          style={[inputStyle, { color: colors.textPrimary }]}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={() => rightAction?.onPress()}
          returnKeyType={rightAction ? "search" : "done"}
        />
        {trailingChild}
        {rightAction && (
          <TouchableOpacity onPress={rightAction.onPress} testID={rightAction.testID}>
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
              {rightAction.label}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {open && (
        <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="suggestions-dropdown">
          {loading ? (
            <View style={styles.row}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.row}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No suggestions</Text>
            </View>
          ) : (
            items.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.row, { borderBottomColor: colors.border }]}
                onPress={() => pick(s)}
                testID={`suggestion-${s}`}
              >
                <Ionicons name="map-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.rowText, { color: colors.textPrimary }]} numberOfLines={2}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filledBox: {
    backgroundColor: "#F7F7F7",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filledInput: { flex: 1, fontSize: 16, color: COLORS.textPrimary, padding: 0 },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F7F7F7", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.textPrimary, padding: 0 },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 6,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 6,
    zIndex: 50,
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
});
