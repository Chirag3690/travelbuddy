import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "@/src/lib/api";
import ProfilePhotoGallery from "@/src/components/ProfilePhotoGallery";
import { useTheme } from "@/src/lib/theme";

export default function GroupDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [group, setGroup] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [invitees, setInvitees] = useState<any[]>([]);
  const [inviting, setInviting] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const g = await api.groupDetail(id);
      setGroup(g);
      if (g.is_admin) {
        const [reqs, candidates] = await Promise.all([
          api.groupRequests(id),
          api.groupInviteCandidates(id),
        ]);
        setRequests(reqs);
        setInvitees(candidates);
      } else {
        setRequests([]);
        setInvitees([]);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const decide = async (requestId: string, accept: boolean) => {
    if (!id) return;
    try {
      if (accept) await api.acceptGroupRequest(id, requestId);
      else await api.rejectGroupRequest(id, requestId);
      load();
    } catch (e: any) {
      Alert.alert("Could not update request", e.message || "");
    }
  };

  const invite = async (userId: string) => {
    if (!id) return;
    setInviting(userId);
    try {
      const updated = await api.inviteGroupMember(id, userId);
      if (updated?.group_id) setGroup(updated);
      setInvitees((prev) => prev.filter((u) => u.user_id !== userId));
      Alert.alert("Invite sent", "They can accept or reject it from their Buddies tab.");
    } catch (e: any) {
      Alert.alert("Could not invite buddy", e.message || "");
    } finally {
      setInviting(null);
    }
  };

  const removeMember = (member: any) => {
    if (!id) return;
    Alert.alert(
      "Remove from squad?",
      `Remove ${member.name} from ${group.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setRemoving(member.user_id);
            try {
              const updated = await api.removeGroupMember(id, member.user_id);
              setGroup(updated);
              load();
            } catch (e: any) {
              Alert.alert("Could not remove member", e.message || "");
            } finally {
              setRemoving(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={[styles.root, styles.center, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.textPrimary }}>Group not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]} testID="group-detail-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View>
          <ProfilePhotoGallery photos={group.photos || []} height={360} />
          <SafeAreaView style={styles.topBar} edges={["top"]}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.textPrimary }]}>{group.name}</Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {group.member_count}/{group.max_members} members · {group.mode}
              </Text>
            </View>
            <View style={[styles.growthBadge, { backgroundColor: colors.success }]}>
              <Ionicons name="trending-up" size={13} color={colors.onPrimary} />
              <Text style={[styles.growthText, { color: colors.onPrimary }]}>Visible</Text>
            </View>
          </View>
          {!!group.location && (
            <Text style={[styles.location, { color: colors.textPrimary }]}>
              <Ionicons name="location-outline" size={14} color={colors.primary} /> {group.location}
            </Text>
          )}
          {!!group.bio && <Text style={[styles.bio, { color: colors.textPrimary }]}>{group.bio}</Text>}
          <TouchableOpacity
            style={[styles.chatBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push(`/group-chat/${group.group_id}`)}
            disabled={!group.is_member}
          >
            <Ionicons name="chatbubbles-outline" size={18} color={colors.onPrimary} />
            <Text style={[styles.chatBtnText, { color: colors.onPrimary }]}>Open group chat</Text>
          </TouchableOpacity>
        </View>

        {!!group.destinations?.length && (
          <Section title="Plans">
            <View style={styles.chips}>
              {group.destinations.map((d: string) => (
                <View key={d} style={[styles.chip, styles.chipDark]}>
                  <Text style={[styles.chipText, { color: "#fff" }]}>{d}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        <Section title="Members">
          {group.members?.map((m: any) => (
            <View key={m.user_id} style={styles.memberRow}>
              <Image source={{ uri: m.picture || undefined }} style={styles.avatar} />
              <Text style={[styles.memberName, { color: colors.textPrimary }]}>{m.name}</Text>
              {m.user_id === group.creator_id && (
                <View style={styles.ownerPill}><Text style={styles.ownerText}>Owner</Text></View>
              )}
              {group.is_admin && m.user_id !== group.creator_id && (
                <TouchableOpacity
                    style={[styles.removeMemberBtn, { backgroundColor: colors.chipBg }]}
                  onPress={() => removeMember(m)}
                  disabled={removing === m.user_id}
                  testID={`remove-member-${m.user_id}`}
                >
                  {removing === m.user_id ? (
                    <ActivityIndicator size="small" color={colors.error} />
                  ) : (
                    <Ionicons name="remove-circle-outline" size={22} color={colors.error} />
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))}
        </Section>

        {group.is_admin && (
          <Section title="Invite buddies">
            {invitees.length === 0 ? (
              <Text style={[styles.muted, { color: colors.textSecondary }]}>
                Match with people first, then invite them into this squad.
              </Text>
            ) : (
              invitees.map((u) => (
                <View key={u.user_id} style={styles.requestRow}>
                  <Image source={{ uri: u.picture || undefined }} style={styles.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberName, { color: colors.textPrimary }]}>{u.name}</Text>
                    <Text style={[styles.muted, { color: colors.textSecondary }]} numberOfLines={1}>
                      {u.location || u.destinations?.slice(0, 2).join(", ") || "Vinle member"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.inviteBtn, { backgroundColor: colors.primary }]}
                    onPress={() => invite(u.user_id)}
                    disabled={inviting === u.user_id}
                    testID={`invite-buddy-${u.user_id}`}
                  >
                    {inviting === u.user_id ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <>
                        <Ionicons name="person-add" size={14} color={colors.onPrimary} />
                        <Text style={[styles.inviteText, { color: colors.onPrimary }]}>Invite</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ))
            )}
          </Section>
        )}

        {group.is_admin && (
          <Section title={`Join requests (${requests.length})`}>
            {requests.length === 0 ? (
              <Text style={[styles.muted, { color: colors.textSecondary }]}>No pending requests.</Text>
            ) : (
              requests.map((req) => (
                <View key={req.request_id} style={styles.requestRow}>
                  <Image source={{ uri: req.user_picture || undefined }} style={styles.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberName, { color: colors.textPrimary }]}>{req.user_name}</Text>
                    <Text style={[styles.muted, { color: colors.textSecondary }]}>{req.user_location || "Wants to join"}</Text>
                  </View>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => decide(req.request_id, false)}>
                    <Ionicons name="close" size={16} color={colors.error} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: colors.success }]} onPress={() => decide(req.request_id, true)}>
                    <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </Section>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: "center", justifyContent: "center" },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  summaryCard: { marginTop: -28, marginHorizontal: 18, backgroundColor: COLORS.surface, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  name: { fontSize: 26, fontWeight: "900", color: COLORS.textPrimary, letterSpacing: -0.5 },
  meta: { color: COLORS.textSecondary, fontWeight: "700", marginTop: 4, textTransform: "capitalize" },
  growthBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.success, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  growthText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  location: { marginTop: 10, color: COLORS.textPrimary, fontWeight: "600" },
  bio: { marginTop: 12, color: COLORS.textPrimary, fontSize: 15, lineHeight: 22 },
  chatBtn: { marginTop: 16, backgroundColor: COLORS.primary, borderRadius: 999, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  chatBtnText: { color: "#fff", fontWeight: "900" },
  section: { marginHorizontal: 18, marginTop: 16, backgroundColor: COLORS.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  sectionTitle: { fontSize: 13, fontWeight: "900", color: COLORS.textPrimary, textTransform: "uppercase", marginBottom: 12, letterSpacing: 0.8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipDark: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.textPrimary, fontWeight: "800", fontSize: 13 },
  memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.chipBg },
  memberName: { flex: 1, color: COLORS.textPrimary, fontWeight: "800" },
  ownerPill: { backgroundColor: COLORS.chipBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  ownerText: { color: COLORS.primary, fontSize: 11, fontWeight: "900" },
  removeMemberBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7E8E2",
  },
  muted: { color: COLORS.textSecondary, fontSize: 13 },
  requestRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  inviteBtn: { minWidth: 82, height: 34, paddingHorizontal: 10, borderRadius: 17, backgroundColor: COLORS.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  inviteText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  acceptBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.success, alignItems: "center", justifyContent: "center" },
  rejectBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#F7E8E2", alignItems: "center", justifyContent: "center" },
});
