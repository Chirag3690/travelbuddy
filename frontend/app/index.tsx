import { useEffect } from "react";
import { ActivityIndicator, View, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/lib/auth";
import { useTheme } from "@/src/lib/theme";

export default function Index() {
  const router = useRouter();
  const { user, loading, signInWithSessionToken } = useAuth();
  const { colors } = useTheme();

  // Handle web callback: ?session_id=... or #session_id=...
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const tokenFromHash = hash.startsWith("#") ? new URLSearchParams(hash.slice(1)).get("session_id") : null;
    const tokenFromQuery = new URLSearchParams(search).get("session_id");
    const sid = tokenFromHash || tokenFromQuery;
    if (sid) {
      window.history.replaceState(null, "", window.location.pathname);
      signInWithSessionToken(sid).catch(() => {});
    }
  }, [signInWithSessionToken]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!user.profile_complete) {
      router.replace("/onboarding");
    } else {
      router.replace("/(tabs)/discover");
    }
  }, [loading, user, router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}
