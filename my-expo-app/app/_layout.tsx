import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../styles/theme";

export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.subtext,
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 92 : 80,
          paddingBottom: Platform.OS === 'ios' ? 18 : 12,
          paddingTop: 8,
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          // iOS7風：モノクロのアウトラインアイコン。色はタブのtintで制御
          tabBarIcon: ({ color }) => (
            <Ionicons name="home-outline" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: '日記',
          tabBarIcon: ({ color }) => (
            <Ionicons name="book-outline" size={26} color={color} />
          ),
        }}
      />
      {/* タブには出さないジャーナルの詳細画面（プッシュ遷移のみ） */}
      <Tabs.Screen
        name="journal/[date]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'タスク',
          tabBarIcon: ({ color }) => (
            <Ionicons name="checkmark-circle-outline" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings-outline" size={26} color={color} />
          ),
        }}
      />
      {/* タブには出さないチャット画面（プッシュ遷移のみ） */}
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="screens/HomeScreen"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
