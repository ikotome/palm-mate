import { Tabs } from "expo-router";
import { Platform, TouchableOpacity, Animated, Easing, GestureResponderEvent, InteractionManager } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../styles/theme";
import NotificationService from "../services/NotificationService";

export default function RootLayout() {
  const [pressedRoute, setPressedRoute] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  type Effect = 'spin' | 'page' | 'pop' | 'bounce';

  // 通知ハンドラ初期化（遷移アニメ完了後に遅延実行）
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      NotificationService.init().catch(() => {});
    });
    return () => task.cancel?.();
  }, []);

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
  const duration = effect === 'pop' ? 220 : effect === 'bounce' ? 280 : effect === 'page' ? 360 : 360;
  const useNative = Platform.OS !== 'web'; // Webは未対応
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

    const style = useMemo(() => {
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
          // 2D回転＋移動で「ページめくり」感を強める
          const rotate = progress.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: ['0deg', '-22deg', '0deg'],
          });
          const translateX = progress.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, -8, 0],
          });
          const translateY = progress.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, -2, 0],
          });
          const scale = progress.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [1, 1.14, 1],
          });
          return { transform: [{ rotate }, { translateX }, { translateY }, { scale }] };
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
    }, [effect, progress]);

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
    const onPressWrapped = useCallback((e: GestureResponderEvent) => {
      pressAnim();
      if (Platform.OS === 'ios') {
        Haptics.selectionAsync().catch(() => {});
      }
      // 少し遅らせてから遷移（アニメを視認）
      setTimeout(() => props.onPress?.(e), 40);
    }, [props.onPress]);
    return (
      <AnimatedTouchable
        {...props}
        style={[props.style, { transform: [{ scale }] }]}
        onPress={onPressWrapped}
      />
    );
  };
  return (
    <Tabs
      detachInactiveScreens
      screenOptions={{
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.subtext,
        headerShown: false,
        tabBarShowLabel: false,
        // Androidでキーボード表示時にタブバーが被らないよう隠す
        tabBarHideOnKeyboard: true,
        // 非表示中は画面ツリーをfreezeしてJS負荷を軽減
        freezeOnBlur: true,
        // タブはフォーカス時に初回マウント（初期負荷を軽減）
        lazy: true,
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
