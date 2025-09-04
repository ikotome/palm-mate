import { Tabs } from "expo-router";
import { Platform, TouchableOpacity } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../styles/theme";

export default function RootLayout() {
  const HapticTabBarButton = (props: any) => (
    <TouchableOpacity
      {...props}
      onPress={(e) => {
        if (Platform.OS === 'ios') {
          Haptics.selectionAsync().catch(() => {});
        }
        props.onPress?.(e);
      }}
    />
  );
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
          tabBarButton: (props) => <HapticTabBarButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: '日記',
          tabBarIcon: ({ color }) => (
            <Ionicons name="book-outline" size={26} color={color} />
          ),
          tabBarButton: (props) => <HapticTabBarButton {...props} />,
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
          tabBarButton: (props) => <HapticTabBarButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings-outline" size={26} color={color} />
          ),
          tabBarButton: (props) => <HapticTabBarButton {...props} />,
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
