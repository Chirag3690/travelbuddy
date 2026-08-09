import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { api, COLORS } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";

type Banner = {
  match_id: string;
  name: string;
  picture?: string | null;
  mode: string;
  shared_destinations?: string[];
};

type Ctx = {
  show: (b: Banner) => void;
};

const NotifCtx = createContext<Ctx | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const [banner, setBanner] = useState<Banner | null>(null);
  const knownMatchIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const ty = useSharedValue(-200);

  const show = useCallback((b: Banner) => {
    setBanner(b);
    ty.value = withSpring(0, { damping: 18, stiffness: 180 });
    // Auto-hide after 4s
    setTimeout(() => {
      ty.value = withSpring(-200, { damping: 18 }, (finished) => {
        if (finished) runOnJS(setBanner)(null);
      });
    }, 4000);
  }, [ty]);

  // Poll /api/matches periodically to catch new ones (e.g. someone liked me back later)
  useEffect(() => {
    if (!user) {
      initialized.current = false;
      knownMatchIds.current.clear();
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await api.matches();
        if (cancelled) return;
        const currentIds = new Set<string>(data.map((m: any) => m.match_id));
        if (!initialized.current) {
          knownMatchIds.current = currentIds;
          initialized.current = true;
          return;
        }
        for (const m of data) {
          if (!knownMatchIds.current.has(m.match_id)) {
            show({
              match_id: m.match_id,
              name: m.name,
              picture: m.picture,
              mode: m.mode,
              shared_destinations: m.shared_destinations || [],
            });
            break; // only the first new one
          }
        }
        knownMatchIds.current = currentIds;
      } catch {}
    };
    tick();
    const t = setInterval(tick, 12000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user, show]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }));

  const onPress = () => {
    if (!banner) return;
    const id = banner.match_id;
    ty.value = withSpring(-200, { damping: 18 }, (f) => { if (f) runOnJS(setBanner)(null); });
    router.push(`/chat/${id}`);
  };

  return (
    <NotifCtx.Provider value={{ show }}>
      {children}
      {banner && (
        <Animated.View
          style={[styles.wrap, aStyle, { paddingTop: Platform.OS === "ios" ? 56 : 28 }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.card}
            onPress={onPress}
            testID="match-banner"
          >
            <View style={styles.iconWrap}>
              {banner.picture ? (
                <Image source={{ uri: banner.picture }} style={styles.avatar} />
              ) : (
                <Ionicons name="sparkles" size={20} color="#fff" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>New match!</Text>
              <Text style={styles.sub} numberOfLines={1}>
                You and {banner.name} matched
                {banner.shared_destinations?.length
                  ? ` · Both going to ${banner.shared_destinations[0]}`
                  : ""}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </NotifCtx.Provider>
  );
}

export function useNotifications() {
  const c = useContext(NotifCtx);
  if (!c) throw new Error("useNotifications must be used within NotificationsProvider");
  return c;
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 100, paddingHorizontal: 14 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 18, padding: 14,
    shadowColor: "#000", shadowOpacity: 0.18, shadowOffset: { width: 0, height: 12 }, shadowRadius: 24,
    elevation: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  avatar: { width: 44, height: 44 },
  title: { fontSize: 15, fontWeight: "800", color: COLORS.textPrimary },
  sub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
});
