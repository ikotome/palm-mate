import { Tabs } from "expo-router";
import { Platform, TouchableOpacity, Animated, Easing, GestureResponderEvent } from "react-native";
import { useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../styles/theme";

export default function RootLayout() {
  const [pressedRoute, setPressedRoute] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  type Effect = 'spin' | 'page' | 'pop' | 'bounce';

  const AnimatedIcon = ({
    name,
    color,
    size = 26,
    focused,
    effect,
    routeName,
    pressedRoute,
    pulse,
  }: {
    name: any;
    color: string;
    size?: number;
    focused: boolean;
    effect: Effect;
    routeName: string;
    pressedRoute: string | null;
    pulse: number;
  }) => {
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      const shouldStart = focused || (pressedRoute === routeName && pulse > 0);
      if (shouldStart) {
        // 単発アニメーション。終了後に0へ戻して次回の発火に備える
  const duration = effect === 'pop' ? 220 : effect === 'bounce' ? 280 : effect === 'page' ? 380 : 360;
        const useNative = Platform.OS !== 'web' && effect !== 'page';
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: effect === 'page' ? Easing.inOut(Easing.ease) : Easing.out(Easing.quad),
          useNativeDriver: useNative,
        }).start(() => {
          progress.setValue(0);
        });
      }
    }, [focused, effect, progress, pressedRoute, routeName, pulse]);

    const style = (() => {
      switch (effect) {
    case 'spin': {
          const rotate = progress.interpolate({
            inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
          });
          const scale = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.06, 1] });
          return { transform: [{ rotate }, { scale }] };
        }
    case 'page': {
          // 本のページがめくれるようなY回転
          const rotateY = progress.interpolate({
            inputRange: [0, 0.5, 1],
      outputRange: ['0deg', '-60deg', '0deg'],
          });
          const translateX = progress.interpolate({
            inputRange: [0, 0.5, 1],
      outputRange: [0, -4, 0],
          });
          const scale = progress.interpolate({
            inputRange: [0, 0.5, 1],
      outputRange: [1, 1.08, 1],
          });
          return { transform: [{ perspective: 800 }, { rotateY }, { translateX }, { scale }] };
        }
        case 'pop': {
          const scale = progress.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [1, 1.22, 1],
          });
          const rotate = progress.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: ['0deg', '-6deg', '0deg'],
          });
          return { transform: [{ scale }, { rotate }] };
        }
        case 'bounce': {
          const translateY = progress.interpolate({
            inputRange: [0, 0.6, 1],
            outputRange: [0, -6, 0],
          });
          const scale = progress.interpolate({
            inputRange: [0, 0.6, 1],
            outputRange: [1, 1.1, 1],
          });
          return { transform: [{ translateY }, { scale }] };
        }
      }
    })();

    return (
      <Animated.View style={style}>
        <Ionicons name={name} size={size} color={color} />
      </Animated.View>
    );
  };

  const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
  const HapticTabBarButton = (props: any) => {
    const scale = useRef(new Animated.Value(1)).current;
    const pressAnim = () =>
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.92, duration: 70, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(scale, { toValue: 1, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    return (
      <AnimatedTouchable
        {...props}
        style={[props.style, { transform: [{ scale }] }]}
        onPress={(e) => {
          pressAnim();
          if (Platform.OS === 'ios') {
            Haptics.selectionAsync().catch(() => {});
          }
          // 少し遅らせてから遷移（アニメを視認）
          setTimeout(() => props.onPress?.(e), 60);
        }}
      />
    );
  };
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
          tabBarIcon: ({ color, focused }) => (
            <AnimatedIcon name="home-outline" color={color} focused={focused} effect="bounce" routeName="index" pressedRoute={pressedRoute} pulse={pulse} />
          ),
      tabBarButton: (props) => (
            <HapticTabBarButton
              {...props}
        onPress={(e: GestureResponderEvent) => {
                setPressedRoute('index');
                setPulse((p) => p + 1);
                props.onPress?.(e);
              }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: '日記',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedIcon name="book-outline" color={color} focused={focused} effect="page" routeName="journal" pressedRoute={pressedRoute} pulse={pulse} />
          ),
      tabBarButton: (props) => (
            <HapticTabBarButton
              {...props}
        onPress={(e: GestureResponderEvent) => {
                setPressedRoute('journal');
                setPulse((p) => p + 1);
                props.onPress?.(e);
              }}
            />
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
          tabBarIcon: ({ color, focused }) => (
            <AnimatedIcon name="checkmark-circle-outline" color={color} focused={focused} effect="pop" routeName="tasks" pressedRoute={pressedRoute} pulse={pulse} />
          ),
      tabBarButton: (props) => (
            <HapticTabBarButton
              {...props}
        onPress={(e: GestureResponderEvent) => {
                setPressedRoute('tasks');
                setPulse((p) => p + 1);
                props.onPress?.(e);
              }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedIcon name="settings-outline" color={color} focused={focused} effect="spin" routeName="settings" pressedRoute={pressedRoute} pulse={pulse} />
          ),
      tabBarButton: (props) => (
            <HapticTabBarButton
              {...props}
        onPress={(e: GestureResponderEvent) => {
                setPressedRoute('settings');
                setPulse((p) => p + 1);
                props.onPress?.(e);
              }}
            />
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
