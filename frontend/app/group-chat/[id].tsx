import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api, COLORS, getToken } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { useTheme } from "@/src/lib/theme";

type Msg = {
  id: string;
  group_id: string;
  sender_id: string;
  sender_name?: string;
  text: string;
  created_at: string;
};

function wsUrl(groupId: string, token: string) {
  const base = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
  const wsBase = base.startsWith("https")
    ? base.replace(/^https/, "wss")
    : base.replace(/^http/, "ws");
  return `${wsBase}/api/ws/groups/${groupId}?token=${encodeURIComponent(token)}`;
}

export default function GroupChat() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [groupName, setGroupName] = useState("Squad chat");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);

  const mergeMessages = useCallback((incoming: Msg[]) => {
    setMessages((prev) => {
      const byId = new Map<string, Msg>();
      for (const m of prev) byId.set(m.id, m);
      for (const m of incoming) byId.set(m.id, m);
      return Array.from(byId.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  }, []);

  const appendMessage = useCallback((msg: Msg) => {
    setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.groupMessages(id);
      mergeMessages(data);
    } finally {
      setLoading(false);
    }
  }, [id, mergeMessages]);

  const loadGroup = useCallback(async () => {
    if (!id) return;
    try {
      const group = await api.groupDetail(id);
      setGroupName(group.name || "Squad chat");
    } catch {}
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
      loadGroup();
      const poll = setInterval(fetchHistory, 3000);
      return () => clearInterval(poll);
    }, [fetchHistory, loadGroup])
  );

  useEffect(() => {
    if (!id) return;
    aliveRef.current = true;
    const connect = async () => {
      const token = await getToken();
      if (!token || !aliveRef.current) return;
      const ws = new WebSocket(wsUrl(id, token));
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          if (payload?.type === "message" && payload.data?.group_id === id) {
            appendMessage(payload.data);
          }
        } catch {}
      };
      ws.onclose = () => {
        setConnected(false);
        if (aliveRef.current) reconnectTimer.current = setTimeout(connect, 2500);
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
    };
    connect();
    return () => {
      aliveRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      try { wsRef.current?.close(); } catch {}
    };
  }, [id, appendMessage]);

  useEffect(() => {
    if (messages.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages.length]);

  const send = async () => {
    const t = text.trim();
    if (!t || !id || sending) return;
    setSending(true);
    setText("");
    const optimistic: Msg = {
      id: `tmp_${Date.now()}`,
      group_id: id,
      sender_id: user?.user_id || "",
      sender_name: user?.name || "Me",
      text: t,
      created_at: new Date().toISOString(),
    };
    appendMessage(optimistic);
    try {
      const msg = await api.sendGroupMessage(id, t);
      setMessages((prev) => {
        const withoutTmp = prev.filter((m) => m.id !== optimistic.id);
        if (withoutTmp.some((m) => m.id === msg.id)) return withoutTmp;
        return [...withoutTmp, msg];
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={["top"]} testID="group-chat-screen">
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{groupName}</Text>
          <Text style={[styles.status, { color: colors.textSecondary }]}>{connected ? "Live squad chat" : "Syncing every few seconds"}</Text>
        </View>
        <TouchableOpacity onPress={() => id && router.push(`/group/${id}`)}>
          <Ionicons name="information-circle-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.user_id;
              return (
                <View style={[styles.row, mine ? styles.mineRow : styles.theirsRow]}>
                  {!mine && <Text style={[styles.sender, { color: colors.textSecondary }]}>{item.sender_name || "Traveler"}</Text>}
                  <View style={[
                    styles.bubble,
                    mine
                      ? [styles.mine, { backgroundColor: colors.primary }]
                      : [styles.theirs, { backgroundColor: colors.surface, borderColor: colors.border }],
                  ]}>
                    <Text style={[styles.bubbleText, { color: colors.textPrimary }, mine && { color: "#fff" }]}>{item.text}</Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={[styles.empty, { color: colors.textSecondary }]}>Start planning with your squad.</Text>}
          />
        )}
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message the squad..."
            placeholderTextColor={COLORS.textSecondary}
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.textPrimary }]}
            multiline
          />
          <TouchableOpacity style={[styles.send, { backgroundColor: colors.primary }, !text.trim() && { opacity: 0.5 }]} disabled={!text.trim()} onPress={send}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#ECE8DF" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: "#fff" },
  title: { fontSize: 17, fontWeight: "900", color: COLORS.textPrimary },
  status: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 14, flexGrow: 1 },
  row: { marginVertical: 3 },
  mineRow: { alignItems: "flex-end" },
  theirsRow: { alignItems: "flex-start" },
  sender: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "700", marginLeft: 8, marginBottom: 2 },
  bubble: { maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  mine: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 16, lineHeight: 22, color: COLORS.textPrimary },
  empty: { textAlign: "center", marginTop: 50, color: COLORS.textSecondary },
  composer: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingTop: 10, gap: 8, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: "#fff" },
  input: { flex: 1, maxHeight: 120, backgroundColor: "#F3F4F6", borderRadius: 20, paddingHorizontal: 16, paddingVertical: Platform.OS === "ios" ? 12 : 10, fontSize: 16, color: COLORS.textPrimary },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
});
