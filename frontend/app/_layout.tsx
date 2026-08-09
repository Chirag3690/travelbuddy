import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/src/lib/auth";
import { NotificationsProvider } from "@/src/components/MatchBanner";
import { ThemeProvider, useTheme } from "@/src/lib/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <NotificationsProvider>
              <ThemedStack />
            </NotificationsProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedStack() {
  const { isNight, colors } = useTheme();
  return (
    <>
      <StatusBar style={isNight ? "light" : "dark"} backgroundColor={colors.bg} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[id]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="group/new" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="group/[id]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="group-chat/[id]" options={{ animation: "slide_from_right" }} />
      </Stack>
    </>
  );
}
