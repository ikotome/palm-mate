import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../styles/theme';
import { Task } from '../models/TaskModel';

interface QuestItemProps {
  task: Task;
  onToggle: (taskId: number) => void;
  onPress?: (task: Task) => void;
}

export const QuestItem: React.FC<QuestItemProps> = ({ task, onToggle, onPress }) => {
  return (
    <View style={[styles.container, task.completed && styles.completedContainer]}>
      <TouchableOpacity style={styles.taskInfo} activeOpacity={0.7} onPress={() => onPress?.(task)}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.title, styles.titleFlex, task.completed && styles.completedTitle]}
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
          <Text style={[styles.description, task.completed && styles.completedDescription]}>
            {task.description}
          </Text>
        )}
      </TouchableOpacity>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, task.completed ? styles.undoButton : styles.completeButton]}
          onPress={() => onToggle(task.id)}
        >
          <Text style={styles.buttonText}>
            {task.completed ? '❌まだ' : '✅できた'}
          </Text>
        </TouchableOpacity>
      </View>
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
  description: {
    fontSize: 14,
    color: theme.colors.subtext,
  },
  completedDescription: {
    textDecorationLine: 'line-through',
    color: theme.colors.subtext,
  },
  buttonContainer: {
    justifyContent: 'center',
  },
  button: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  completeButton: {
    backgroundColor: theme.colors.text,
  },
  undoButton: {
    backgroundColor: theme.colors.muted,
  },
  buttonText: {
    color: theme.colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
});
