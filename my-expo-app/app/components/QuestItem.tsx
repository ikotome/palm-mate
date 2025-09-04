import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Task } from '../models/TaskModel';

interface QuestItemProps {
  task: Task;
  onToggle: (taskId: number) => void;
}

export const QuestItem: React.FC<QuestItemProps> = ({ task, onToggle }) => {
  return (
    <View style={[styles.container, task.completed && styles.completedContainer]}>
      <View style={styles.taskInfo}>
        <Text style={[styles.title, task.completed && styles.completedTitle]}>
          {task.title}
        </Text>
        {task.description && (
          <Text style={[styles.description, task.completed && styles.completedDescription]}>
            {task.description}
          </Text>
        )}
      </View>
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
    backgroundColor: 'white',
    padding: 15,
    marginVertical: 5,
    marginHorizontal: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  completedContainer: {
    backgroundColor: '#f0f8f0',
    opacity: 0.8,
  },
  taskInfo: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    color: '#666',
  },
  description: {
    fontSize: 14,
    color: '#666',
  },
  completedDescription: {
    textDecorationLine: 'line-through',
    color: '#999',
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
  },
  completeButton: {
    backgroundColor: '#4CAF50',
  },
  undoButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
