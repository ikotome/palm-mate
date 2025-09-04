import { Tabs } from "expo-router";
import { Text } from "react-native";

export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
        tabBarStyle: {
          height: 80,
          paddingBottom: 10,
          paddingTop: 10,
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginBottom: -4,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 28 : 24 }}>🏠</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: '日記',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 28 : 24 }}>📖</Text>
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
            <Text style={{ fontSize: focused ? 28 : 24 }}>✅</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 28 : 24 }}>⚙️</Text>
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
    </Tabs>
  );
}
