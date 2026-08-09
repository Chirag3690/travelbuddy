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
  match_id: string;
  sender_id: string;
  text: string;
  created_at: string;
};

function wsUrl(matchId: string, token: string) {
  const base = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
  const wsBase = base.startsWith("https")
    ? base.replace(/^https/, "wss")
    : base.replace(/^http/, "ws");
  return `${wsBase}/api/ws/chats/${matchId}?token=${encodeURIComponent(token)}`;
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function Chat() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [peerName, setPeerName] = useState("Chat");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);
  const messagesRef = useRef<Msg[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.messages(id);
      mergeMessages(data);
    } catch {
      /* keep existing */
    } finally {
      setLoading(false);
    }
  }, [id, mergeMessages]);

  const loadPeer = useCallback(async () => {
    if (!id) return;
    try {
      const matches = await api.matches();
      const m = matches.find((x: any) => x.match_id === id);
      if (m?.name) setPeerName(m.name);
    } catch {}
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchHistory();
      loadPeer();
      const poll = setInterval(fetchHistory, 3000);
      return () => clearInterval(poll);
    }, [fetchHistory, loadPeer])
  );

  useEffect(() => {
    if (!id) return;
    aliveRef.current = true;

    const connect = async () => {
      const token = await getToken();
      if (!token || !aliveRef.current) return;
      try {
        const ws = new WebSocket(wsUrl(id, token));
        wsRef.current = ws;
        ws.onopen = () => setConnected(true);
        ws.onmessage = (evt) => {
          try {
            const payload = JSON.parse(evt.data);
            if (payload?.type === "message" && payload.data?.match_id === id) {
              appendMessage(payload.data);
            }
          } catch {}
        };
        ws.onclose = () => {
          setConnected(false);
          if (aliveRef.current) {
            reconnectTimer.current = setTimeout(connect, 2500);
          }
        };
        ws.onerror = () => {
          try {
            ws.close();
          } catch {}
        };
      } catch {
        if (aliveRef.current) reconnectTimer.current = setTimeout(connect, 2500);
      }
    };

    connect();

    return () => {
      aliveRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
      }
    };
  }, [id, appendMessage]);

  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length]);

  const send = async () => {
    const t = text.trim();
    if (!t || !id || sending) return;
    setSending(true);
    const optimistic: Msg = {
      id: `tmp_${Date.now()}`,
      match_id: id,
      sender_id: user?.user_id || "",
      text: t,
      created_at: new Date().toISOString(),
    };
    appendMessage(optimistic);
    setText("");
    try {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ text: t }));
        setTimeout(fetchHistory, 400);
      } else {
        const m = await api.sendMessage(id, t);
        setMessages((prev) => {
          const withoutTmp = prev.filter((x) => x.id !== optimistic.id);
          if (withoutTmp.some((x) => x.id === m.id)) return withoutTmp;
          return [...withoutTmp, m];
        });
      }
    } catch {
      setMessages((prev) => prev.filter((x) => x.id !== optimistic.id));
      setText(t);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={["top"]} testID="chat-screen">
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} testID="chat-back-button">
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {peerName}
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: connected ? COLORS.success : COLORS.warning },
              ]}
            />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              {connected ? "Live" : "Syncing every few seconds"}
            </Text>
          </View>
        </View>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
            renderItem={({ item, index }) => {
              const mine = item.sender_id === user?.user_id;
              const prev = index > 0 ? messages[index - 1] : null;
              const showTime =
                !prev ||
                new Date(item.created_at).getTime() - new Date(prev.created_at).getTime() >
                  5 * 60 * 1000;
              return (
                <View>
                  {showTime && (
                    <Text style={styles.timeDivider}>{formatTime(item.created_at)}</Text>
                  )}
                  <View
                    style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}
                    testID={`message-${item.id}`}
                  >
                    <View style={[
                      styles.bubble,
                      mine
                        ? [styles.mine, { backgroundColor: colors.primary }]
                        : [styles.theirs, { backgroundColor: colors.surface, borderColor: colors.border }],
                    ]}>
                      <Text style={[styles.bubbleText, { color: colors.textPrimary }, mine && { color: "#fff" }]}>
                        {item.text}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Ionicons name="chatbubbles-outline" size={40} color={colors.border} />
                <Text style={[styles.emptyChatTitle, { color: colors.textPrimary }]}>Start the conversation</Text>
                <Text style={[styles.emptyChatSub, { color: colors.textSecondary }]}>Say hi and plan your trip together.</Text>
              </View>
            }
          />
        )}

        <View
          style={[
            styles.composer,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
            { paddingBottom: Math.max(insets.bottom, 10) },
          ]}
        >
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder="Type a message…"
            placeholderTextColor={COLORS.textSecondary}
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.textPrimary }]}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            onPress={send}
            style={[styles.send, { backgroundColor: colors.primary }, (!text.trim() || sending) && styles.sendDisabled]}
            disabled={!text.trim() || sending}
            testID="chat-send-button"
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#ECE8DF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: "#fff",
  },
  headerTitle: { fontWeight: "800", fontSize: 17, color: COLORS.textPrimary },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "600" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, flexGrow: 1 },
  timeDivider: {
    textAlign: "center",
    fontSize: 11,
    color: COLORS.textSecondary,
    marginVertical: 10,
    fontWeight: "600",
  },
  bubbleRow: { marginVertical: 2 },
  rowMine: { alignItems: "flex-end" },
  rowTheirs: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  mine: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  theirs: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bubbleText: { fontSize: 16, color: COLORS.textPrimary, lineHeight: 22 },
  bubbleTextMine: { color: "#fff" },
  emptyChat: { alignItems: "center", marginTop: 48, paddingHorizontal: 24 },
  emptyChatTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginTop: 12,
  },
  emptyChatSub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 6,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.45 },
});
