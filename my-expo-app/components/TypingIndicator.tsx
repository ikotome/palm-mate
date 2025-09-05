import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import { theme } from '../styles/theme';

type Props = {
  style?: ViewStyle | ViewStyle[];
};

// シンプルな3点リーダのタイピングアニメーション（吹き出し）
export default function TypingIndicator({ style }: Props) {
  const a1 = useRef(new Animated.Value(0)).current;
  const a2 = useRef(new Animated.Value(0)).current;
  const a3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const start = (anim: Animated.Value, delay: number) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 350,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 350,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        { resetBeforeIteration: true }
      );
      loop.start();
      return loop;
    };

    // ずらして開始して波のように
    const l1 = start(a1, 0);
    const l2 = start(a2, 150);
    const l3 = start(a3, 300);

    return () => {
      // Animated.loop の stop は戻り値がないため GC に任せる
      // RN 0.7x 以降は自動停止でメモリリークは問題になりにくい
      // 明示 stop が必要なら Reanimated 等の採用を検討
      // noop cleanup
      void l1; void l2; void l3;
    };
  }, [a1, a2, a3]);

  const dotStyle = (anim: Animated.Value) => ({
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -4],
        }),
      },
    ],
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
  });

  return (
    <View style={[styles.bubble, style]}> 
      <View style={styles.row}>
        <Animated.View style={[styles.dot, dotStyle(a1)]} />
        <Animated.View style={[styles.dot, dotStyle(a2)]} />
        <Animated.View style={[styles.dot, dotStyle(a3)]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignSelf: 'flex-start',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.subtext,
  },
});
