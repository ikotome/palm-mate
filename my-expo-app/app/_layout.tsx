import { Tabs } from "expo-router";
import { Text, Platform } from "react-native";
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
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 24 : 22 }}>🏠</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: '日記',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 24 : 22 }}>📖</Text>
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
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 24 : 22 }}>✅</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 24 : 22 }}>⚙️</Text>
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
