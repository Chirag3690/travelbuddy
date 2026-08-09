import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "@/src/lib/api";
import { useTheme } from "@/src/lib/theme";

type Match = {
  match_id: string;
  user_id: string;
  name: string;
  picture?: string | null;
  mode: string;
  created_at: string;
  last_message?: string | null;
  shared_destinations?: string[];
};

export default function Matches() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, copy, isVinci } = useTheme();
  const [items, setItems] = useState<Match[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [data, groupData] = await Promise.all([api.matches(), api.myGroups()]);
      setItems(data);
      setGroups(groupData.groups || []);
      setRequests(groupData.requests || []);
      setInvitations(groupData.invitations || []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 8000);
      return () => clearInterval(t);
    }, [load])
  );

  const respondToInvite = async (invite: any, accept: boolean) => {
    try {
      if (accept) await api.acceptGroupInvitation(invite.group_id, invite.request_id);
      else await api.rejectGroupInvitation(invite.group_id, invite.request_id);
      load();
    } catch {}
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]} testID="matches-screen">
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
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.h1, { color: colors.primary }]}>{copy.buddiesTitle}</Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              {items.length + groups.length
                ? copy.buddiesSub(items.length, groups.length)
                : copy.buddiesSubEmpty}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/group/new")}
          >
            <Ionicons name="add" size={20} color={colors.onPrimary} />
            <Text style={[styles.createBtnText, { color: colors.onPrimary }]}>{copy.squadBtn}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {items.length === 0 && groups.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name={isVinci ? "people-circle-outline" : "people-outline"} size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{copy.buddiesEmptyTitle}</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{copy.buddiesEmptySub}</Text>
          <TouchableOpacity style={[styles.emptyCreate, { backgroundColor: colors.primary }]} onPress={() => router.push("/group/new")}>
            <Text style={[styles.emptyCreateText, { color: colors.onPrimary }]}>{copy.createSquadBtn}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={[
            ...(invitations.length ? [{ type: "invitations", id: "invitations" }] : []),
            ...(requests.length ? [{ type: "requests", id: "requests" }] : []),
            ...(groups.length ? [{ type: "section", id: "groups", title: copy.sectionMySquads }] : []),
            ...groups.map((g) => ({ type: "group", id: g.group_id, item: g })),
            ...(items.length ? [{ type: "section", id: "people", title: copy.sectionPeople }] : []),
            ...items.map((m) => ({ type: "person", id: m.match_id, item: m })),
          ]}
          keyExtractor={(row: any) => row.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
          contentContainerStyle={styles.list}
          renderItem={({ item: row }: any) => {
            if (row.type === "section") {
              return <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{row.title}</Text>;
            }
            if (row.type === "invitations") {
              return (
                <View style={styles.invitesBlock}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{copy.sectionInvitations}</Text>
                  {invitations.map((inv) => (
                    <View key={inv.request_id} style={[styles.inviteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Image source={{ uri: inv.group_photo || undefined }} style={styles.inviteAvatar} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{inv.group_name}</Text>
                        <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={1}>
                          {inv.inviter_name} invited you · {inv.group_destination || inv.group_mode}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.inviteReject} onPress={() => respondToInvite(inv, false)}>
                        <Ionicons name="close" size={16} color={COLORS.error} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.inviteAccept} onPress={() => respondToInvite(inv, true)}>
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              );
            }
            if (row.type === "requests") {
              return (
                <TouchableOpacity style={styles.requestBanner} onPress={() => groups[0] && router.push(`/group/${groups[0].group_id}`)}>
                  <Ionicons name="notifications" size={16} color="#fff" />
                  <Text style={styles.requestBannerText}>{requests.length} pending squad request{requests.length === 1 ? "" : "s"}</Text>
                </TouchableOpacity>
              );
            }
            if (row.type === "group") {
              const group = row.item;
              return (
                <TouchableOpacity
                  style={[styles.row, { borderBottomColor: colors.border }]}
                  onPress={() => router.push(`/group/${group.group_id}`)}
                  testID={`group-row-${group.group_id}`}
                >
                  <Image source={{ uri: group.photos?.[0] || undefined }} style={styles.avatar} />
                  <View style={styles.body}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{group.name}</Text>
                      <View style={[styles.modePill, { backgroundColor: colors.chipBg }]}><Text style={[styles.modeText, { color: colors.primary }]}>{group.mode}</Text></View>
                    </View>
                    <Text style={[styles.going, { color: colors.primary }]} numberOfLines={1}>
                      {group.member_count}/{group.max_members} members · {group.destinations?.slice(0, 2).join(", ")}
                    </Text>
                    <Text style={[styles.previewMuted, { color: colors.textSecondary }]}>Tap for members, requests and group chat</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              );
            }
            const item = row.item as Match;
            return (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: colors.border }]}
                onPress={() => router.push(`/chat/${item.match_id}`)}
                testID={`match-row-${item.match_id}`}
              >
                <Image source={{ uri: item.picture || undefined }} style={styles.avatar} />
                <View style={styles.body}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
                    <View style={[styles.modePill, { backgroundColor: colors.chipBg }]}><Text style={[styles.modeText, { color: colors.primary }]}>{item.mode}</Text></View>
                  </View>
                  {item.shared_destinations?.length ? (
                    <Text style={[styles.going, { color: colors.primary }]} numberOfLines={1}>
                      <Ionicons name="sparkles" size={11} color={COLORS.primary} /> Both going to{" "}
                      {item.shared_destinations.slice(0, 2).join(", ")}
                    </Text>
                  ) : null}
                  {item.last_message ? (
                    <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={1}>{item.last_message}</Text>
                  ) : (
                    <Text style={[styles.previewMuted, { color: colors.textSecondary }]}>Tap to say hi</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
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
  brandZone: { paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  brandAccent: { height: 3, borderRadius: 2, marginBottom: 12 },
  h1: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.primary,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  sub: {
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 4,
    fontSize: 13,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    flexShrink: 0,
  },
  createBtnText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary, marginTop: 12 },
  emptySub: { color: COLORS.textSecondary, textAlign: "center", marginTop: 6 },
  emptyCreate: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  emptyCreateText: { color: "#fff", fontWeight: "800" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.textSecondary,
    marginTop: 14,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  requestBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
  },
  requestBannerText: { color: "#fff", fontWeight: "800" },
  invitesBlock: { marginBottom: 8 },
  inviteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  inviteAvatar: { width: 46, height: 46, borderRadius: 12, backgroundColor: COLORS.chipBg },
  inviteAccept: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.success, alignItems: "center", justifyContent: "center" },
  inviteReject: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#F7E8E2", alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
    backgroundColor: COLORS.chipBg,
  },
  body: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 16, fontWeight: "800", color: COLORS.textPrimary, flexShrink: 1 },
  modePill: {
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  modeText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.primary,
    textTransform: "uppercase",
  },
  going: { fontSize: 12, color: COLORS.primary, marginTop: 3, fontWeight: "600" },
  preview: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  previewMuted: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, fontStyle: "italic" },
});
