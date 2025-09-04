import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { theme } from '../styles/theme';
import { Task } from '../models/TaskModel';
import * as Haptics from 'expo-haptics';

interface QuestItemProps {
  task: Task;
  onToggle: (taskId: number) => void;
  onPress?: (task: Task) => void;
  onLongPressQuickSkip?: (task: Task) => void;
}

export const QuestItem: React.FC<QuestItemProps> = ({ task, onToggle, onPress, onLongPressQuickSkip }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const checkOpacity = useRef(new Animated.Value(task.completed ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(checkOpacity, {
      toValue: task.completed ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [task.completed, checkOpacity]);

  const handleToggle = async () => {
    // ちょい弾むスケールアニメーション
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.15, useNativeDriver: true, friction: 5, tension: 120 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 100 }),
    ]).start();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(task.id);
  };

  const isSkipped = task.status === 'skipped';
  return (
    <View style={[styles.container, task.completed && styles.completedContainer, isSkipped && styles.skippedContainer]}>
      {/* 左側チェックボックス */}
    <TouchableOpacity
        onPress={handleToggle}
        onLongPress={async () => {
          // 長押しでスキップ/スキップ解除（詳細に行かなくても素早く操作）
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onLongPressQuickSkip?.(task);
        }}
        activeOpacity={0.8}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.checkboxTouchable}
      >
        <Animated.View
          style={[
            styles.checkbox,
            !task.completed ? styles.checkboxGreen : styles.checkboxPurple,
            { transform: [{ scale }] },
          ]}
        >
          {/* 完了時のみチェックをフェードイン */}
          <Animated.Text style={[styles.checkmark, { opacity: checkOpacity }]}>✓</Animated.Text>
        </Animated.View>
      </TouchableOpacity>

      {/* タスク情報 */}
      <TouchableOpacity style={styles.taskInfo} activeOpacity={0.7} onPress={() => onPress?.(task)}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.title, styles.titleFlex, task.completed && styles.completedTitle, isSkipped && styles.skippedTitle]}
          >
            {task.title}
          </Text>
          {/* 右側に優先度/期限バッジ */}
          <View style={styles.badgesRow}>
            <View style={[styles.priorityDot, task.priority === 'high' ? styles.priorityHigh : task.priority === 'medium' ? styles.priorityMedium : styles.priorityLow]} />
            {task.dueDate && (
              <View style={styles.dueBadge}>
                <Text style={styles.dueBadgeText}>期限: {task.dueDate}</Text>
              </View>
            )}
          </View>
        </View>
        {task.description && (
          <Text style={[styles.description, task.completed && styles.completedDescription, isSkipped && styles.skippedDescription]}>
            {task.description}
          </Text>
        )}
        {/* 下部の薄い区切り線でカード間の視認性UP */}
        <View style={styles.separator} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
  padding: 16,
    marginVertical: 5,
  marginHorizontal: 8,
  borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  completedContainer: {
    backgroundColor: theme.colors.accentSoft,
    opacity: 0.9,
  },
  skippedContainer: {
    backgroundColor: '#fafafa',
    opacity: 0.7,
  },
  checkboxTouchable: {
    justifyContent: 'center',
  marginRight: 14,
  },
  checkbox: {
  width: 24,
  height: 24,
  borderRadius: 7,
  borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxGreen: {
    borderColor: theme.colors.accent,
    backgroundColor: 'transparent',
  },
  checkboxPurple: {
    borderColor: theme.colors.purple,
    backgroundColor: theme.colors.purple,
  },
  checkmark: {
    color: theme.colors.surface,
    fontSize: 15,
    fontWeight: 'bold',
    lineHeight: 16,
  },
  taskInfo: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleFlex: {
    flex: 1,
    marginRight: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.subtext,
  },
  priorityHigh: { backgroundColor: '#ef4444' },
  priorityMedium: { backgroundColor: '#f59e0b' },
  priorityLow: { backgroundColor: '#10b981' },
  dueBadge: {
    marginLeft: 8,
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  dueBadgeText: {
    fontSize: 12,
    color: theme.colors.surface,
    fontWeight: '700',
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    color: theme.colors.subtext,
  },
  skippedTitle: {
    color: theme.colors.subtext,
    fontStyle: 'italic',
  },
  description: {
    fontSize: 14,
    color: theme.colors.subtext,
  },
  completedDescription: {
    textDecorationLine: 'line-through',
    color: theme.colors.subtext,
  },
  skippedDescription: {
    color: theme.colors.subtext,
    fontStyle: 'italic',
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.muted,
    opacity: 0.6,
    marginTop: 10,
  },
  // ボタン関連のスタイルは削除（チェックボックスに置換）
});
