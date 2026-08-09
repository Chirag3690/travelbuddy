import { View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/lib/theme";
import VinciBackdrop from "@/src/components/VinciBackdrop";
import AnimatedTabBar from "@/src/components/AnimatedTabBar";

const Icon = (name: keyof typeof Ionicons.glyphMap) => {
  function TabIcon({ color, size }: { color: string; size: number }) {
    return <Ionicons name={name} size={size} color={color} />;
  }
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
};

export default function TabsLayout() {
  const { colors, copy } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <VinciBackdrop layout="screen" />
      <Tabs
        tabBar={(props) => <AnimatedTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="discover"
          options={{ title: copy.tabs.discover, tabBarIcon: Icon(copy.tabIcons.discover) }}
        />
        <Tabs.Screen
          name="matches"
          options={{ title: copy.tabs.matches, tabBarIcon: Icon(copy.tabIcons.matches) }}
        />
        <Tabs.Screen
          name="chats"
          options={{ title: copy.tabs.chats, tabBarIcon: Icon(copy.tabIcons.chats) }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: copy.tabs.profile, tabBarIcon: Icon(copy.tabIcons.profile) }}
        />
      </Tabs>
    </View>
  );
}
