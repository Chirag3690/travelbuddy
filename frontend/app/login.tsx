import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useAuth } from "@/src/lib/auth";
import { useTheme } from "@/src/lib/theme";
import VinciBackdrop from "@/src/components/VinciBackdrop";

const HERO =
  "https://images.unsplash.com/photo-1508904635850-d986b19765d0?w=1200&q=80";

const { width: SCREEN_W } = Dimensions.get("window");

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

function VinleHeroTitle() {
  const { colors, copy } = useTheme();
  const drift = useSharedValue(0);
  const pulse = useSharedValue(0);
  const brand = colors.primary;
  const ink = colors.primary;

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    pulse.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [drift, pulse]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(drift.value, [0, 1], [-SCREEN_W * 0.35, SCREEN_W * 0.35]),
      },
      { rotate: `${interpolate(drift.value, [0, 1], [-8, 8])}deg` },
    ],
    opacity: interpolate(drift.value, [0, 0.5, 1], [0.45, 0.95, 0.45]),
  }));

  const orbLeftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [-18, 22]) },
      { translateY: interpolate(pulse.value, [0, 1], [8, -12]) },
      { scale: interpolate(pulse.value, [0, 1], [0.92, 1.12]) },
    ],
    opacity: interpolate(pulse.value, [0, 1], [0.28, 0.5]),
  }));

  const orbRightStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [24, -16]) },
      { translateY: interpolate(pulse.value, [0, 1], [-10, 14]) },
      { scale: interpolate(pulse.value, [0, 1], [1.08, 0.94]) },
    ],
    opacity: interpolate(pulse.value, [0, 1], [0.22, 0.42]),
  }));

  const titleGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.55, 0.9]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.04]) }],
  }));

  return (
    <View style={styles.heroBlock}>
      <Animated.View style={[styles.glowOrb, styles.glowOrbLeft, orbLeftStyle]} pointerEvents="none">
        <LinearGradient
          colors={[`${brand}88`, "transparent"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.2, y: 0.2 }}
          end={{ x: 0.9, y: 0.9 }}
        />
      </Animated.View>
      <Animated.View style={[styles.glowOrb, styles.glowOrbRight, orbRightStyle]} pointerEvents="none">
        <LinearGradient
          colors={[`${colors.secondary}55`, "transparent"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.8, y: 0.1 }}
          end={{ x: 0.1, y: 0.9 }}
        />
      </Animated.View>

      <View style={styles.titleStack}>
        <Animated.View style={[styles.titleGlow, titleGlowStyle]} pointerEvents="none">
          <LinearGradient
            colors={[`${brand}55`, `${colors.textPrimary}18`, `${ink}33`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Text style={styles.heroTitle} accessibilityRole="header">
          Vinle
        </Text>

        <View style={styles.shimmerMask} pointerEvents="none">
          <AnimatedLinearGradient
            colors={[
              "transparent",
              `${colors.textPrimary}22`,
              `${brand}CC`,
              `${ink}EE`,
              `${brand}CC`,
              `${colors.textPrimary}22`,
              "transparent",
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.shimmerBand, shimmerStyle]}
          />
        </View>
      </View>

      <Text style={[styles.heroTagline, { color: colors.primary }]}>{copy.appTagline}</Text>
    </View>
  );
}

export default function Login() {
  const router = useRouter();
  const { signInWithSessionToken } = useAuth();
  const { colors, copy, isVinci } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const redirectUrl =
        Platform.OS === "web"
          ? window.location.origin + "/"
          : Linking.createURL("auth");

      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === "web") {
        window.location.href = authUrl;
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type !== "success" || !result.url) {
        setLoading(false);
        return;
      }
      const url = result.url;
      const hashMatch = url.match(/[#&?]session_id=([^&]+)/);
      const sessionId = hashMatch ? decodeURIComponent(hashMatch[1]) : null;
      if (!sessionId) {
        Alert.alert("Login error", "Could not read session.");
        setLoading(false);
        return;
      }
      const user = await signInWithSessionToken(sessionId);
      if (user?.profile_complete) router.replace("/(tabs)/discover");
      else router.replace("/onboarding");
    } catch (e: any) {
      Alert.alert("Login failed", e.message || "Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]} testID="login-screen">
      <Image source={{ uri: HERO }} style={styles.hero} />
      <LinearGradient
        colors={[`${colors.bg}22`, `${colors.bg}BB`, colors.bg]}
        locations={[0, 0.45, 1]}
        style={styles.gradient}
      />
      <LinearGradient
        colors={[`${colors.primary}28`, "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.55 }}
        style={styles.topGlow}
        pointerEvents="none"
      />
      {isVinci && <VinciBackdrop layout="login" />}

      <SafeAreaView style={styles.content} edges={["bottom", "top"]}>
        <View style={styles.heroSection}>
          <VinleHeroTitle />
        </View>

        <View style={styles.bottomSection}>
          <Text style={styles.headline}>{copy.loginHeadline}</Text>
          <Text style={styles.subtitle}>{copy.loginSubtitle}</Text>

          <TouchableOpacity
            testID="google-login-button"
            style={[styles.googleBtn, { borderColor: colors.primary }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#111" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#111" />
                <Text style={styles.googleText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.legal}>
            By continuing, you agree to our Terms & Privacy.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#08090D" },
  hero: { position: "absolute", inset: 0 as any, width: "100%", height: "100%" },
  gradient: { position: "absolute", inset: 0 as any, width: "100%", height: "100%" },
  topGlow: { position: "absolute", top: 0, left: 0, right: 0, height: "48%" },
  content: { flex: 1, paddingHorizontal: 24, paddingBottom: 32 },
  heroSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 12,
  },
  heroBlock: {
    alignItems: "center",
    width: "100%",
  },
  glowOrb: {
    position: "absolute",
    width: SCREEN_W * 0.72,
    height: SCREEN_W * 0.72,
    borderRadius: SCREEN_W * 0.36,
  },
  glowOrbLeft: { top: -SCREEN_W * 0.12, left: -SCREEN_W * 0.22 },
  glowOrbRight: { top: SCREEN_W * 0.02, right: -SCREEN_W * 0.28 },
  titleStack: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  titleGlow: {
    position: "absolute",
    width: SCREEN_W * 0.88,
    height: 120,
    borderRadius: 60,
    top: "50%",
    marginTop: -60,
  },
  heroTitle: {
    fontSize: Math.min(92, SCREEN_W * 0.22),
    lineHeight: Math.min(96, SCREEN_W * 0.23),
    fontWeight: "900",
    letterSpacing: -4,
    color: "#F8F4EC",
    textAlign: "center",
    textShadowColor: "rgba(232,85,77,0.45)",
    textShadowOffset: { width: 0, height: 10 },
    textShadowRadius: 28,
  },
  shimmerMask: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  shimmerBand: {
    width: SCREEN_W * 0.9,
    height: "120%",
    marginTop: "-10%",
  },
  heroTagline: {
    marginTop: 18,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 5,
    textTransform: "uppercase",
  },
  bottomSection: {
    paddingTop: 8,
  },
  headline: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
    marginBottom: 12,
    letterSpacing: -0.6,
  },
  subtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  googleBtn: {
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 2,
  },
  googleText: { color: "#111", fontSize: 16, fontWeight: "700" },
  legal: {
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: 16,
    fontSize: 12,
  },
});
