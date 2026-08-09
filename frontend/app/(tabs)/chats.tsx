import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "@/src/lib/api";
import { useTheme } from "@/src/lib/theme";

export default function Chats() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, copy, isVinci } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [data, groupData] = await Promise.all([api.matches(), api.myGroups()]);
      setItems(data);
      setGroups(groupData.groups || []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 5000);
      return () => clearInterval(t);
    }, [load])
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]} testID="chats-screen">
      <View
        style={[
          styles.brandZone,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={[styles.brandAccent, { backgroundColor: colors.primary }]} />
        <Text style={[styles.h1, { color: colors.primary }]}>{copy.chatsTitle}</Text>
      </View>
      {items.length === 0 && groups.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name={isVinci ? "document-text-outline" : "chatbubble-ellipses-outline"} size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{copy.chatsEmptyTitle}</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{copy.chatsEmptySub}</Text>
        </View>
      ) : (
        <FlatList
          data={[
            ...(groups.length ? [{ type: "section", id: "groups", title: copy.sectionSquads }] : []),
            ...groups.map((g) => ({ type: "group", id: g.group_id, item: g })),
            ...(items.length ? [{ type: "section", id: "people", title: copy.sectionPeople }] : []),
            ...items.map((m) => ({ type: "person", id: m.match_id, item: m })),
          ]}
          keyExtractor={(row: any) => row.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          renderItem={({ item: row }: any) => {
            if (row.type === "section") return <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{row.title}</Text>;
            const item = row.item;
            const isGroup = row.type === "group";
            return (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: colors.border }]}
                onPress={() => router.push(isGroup ? `/group-chat/${item.group_id}` : `/chat/${item.match_id}`)}
                testID={isGroup ? `group-chat-row-${item.group_id}` : `chat-row-${item.match_id}`}
              >
                <Image source={{ uri: (isGroup ? item.photos?.[0] : item.picture) || undefined }} style={styles.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: colors.textPrimary }]}>{item.name}</Text>
                  <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={1}>
                    {isGroup ? `${item.member_count}/${item.max_members} travelers · group chat` : (item.last_message || "Say hi 👋")}
                  </Text>
                </View>
              <View style={[styles.dot, { backgroundColor: colors.primary }]}>
                <Text style={[styles.dotText, { color: colors.bg }]}>{isGroup ? "G" : item.mode[0].toUpperCase()}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  brandZone: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  brandAccent: { height: 3, borderRadius: 2, marginBottom: 12 },
  h1: { fontSize: 28, fontWeight: "800", color: COLORS.primary },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary, marginTop: 12 },
  emptySub: { color: COLORS.textSecondary, textAlign: "center", marginTop: 6 },
  sectionTitle: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 12, marginBottom: 4 },
  row: {
    flexDirection: "row", alignItems: "center", paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12, backgroundColor: "#ddd" },
  name: { fontSize: 16, fontWeight: "800", color: COLORS.textPrimary },
  preview: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  dot: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
  dotText: { color: "#fff", fontWeight: "800", fontSize: 12 },
});
