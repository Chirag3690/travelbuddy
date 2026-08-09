import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useAuth } from "@/src/lib/auth";
import { COLORS } from "@/src/lib/api";

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{ session_id?: string }>();
  const { signInWithSessionToken } = useAuth();

  useEffect(() => {
    (async () => {
      let sid = params.session_id;
      if (!sid) {
        const initial = await Linking.getInitialURL();
        if (initial) {
          const m = initial.match(/[#&?]session_id=([^&]+)/);
          sid = m ? decodeURIComponent(m[1]) : undefined;
        }
      }
      if (sid) {
        try {
          const u = await signInWithSessionToken(sid);
          if (u?.profile_complete) router.replace("/(tabs)/discover");
          else router.replace("/onboarding");
          return;
        } catch {}
      }
      router.replace("/login");
    })();
  }, [params.session_id, signInWithSessionToken, router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg }}>
      <ActivityIndicator color={COLORS.primary} size="large" />
    </View>
  );
}
