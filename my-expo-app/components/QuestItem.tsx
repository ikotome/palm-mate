import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { theme } from '../styles/theme';
import { Task } from '../models/TaskModel';

interface QuestItemProps {
  task: Task;
  onToggle: (taskId: number) => void;
  onPress?: (task: Task) => void;
}

export const QuestItem: React.FC<QuestItemProps> = ({ task, onToggle, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const checkOpacity = useRef(new Animated.Value(task.completed ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(checkOpacity, {
      toValue: task.completed ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [task.completed, checkOpacity]);

  const handleToggle = () => {
    // ちょい弾むスケールアニメーション
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.15, useNativeDriver: true, friction: 5, tension: 120 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 100 }),
    ]).start();
    onToggle(task.id);
  };

  const isSkipped = task.status === 'skipped';
  return (
    <View style={[styles.container, task.completed && styles.completedContainer, isSkipped && styles.skippedContainer]}>
      {/* 左側チェックボックス */}
      <TouchableOpacity
        onPress={handleToggle}
        activeOpacity={0.8}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
          {task.dueDate && (
            <View style={styles.dueBadge}>
              <Text style={styles.dueBadgeText}>期限: {task.dueDate}</Text>
            </View>
          )}
        </View>
        {task.description && (
          <Text style={[styles.description, task.completed && styles.completedDescription, isSkipped && styles.skippedDescription]}>
            {task.description}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    padding: 15,
    marginVertical: 5,
    marginHorizontal: 10,
    borderRadius: 10,
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
    marginRight: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
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
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 16,
  },
  taskInfo: {
    flex: 1,
    marginRight: 10,
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
  // ボタン関連のスタイルは削除（チェックボックスに置換）
});
