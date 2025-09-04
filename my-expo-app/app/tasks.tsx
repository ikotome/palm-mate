import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import DatabaseService from './services/DatabaseService';
import GeminiService, { PersonalizedTask } from './services/GeminiService';
import { Task } from './models/TaskModel';
import { UserProfile } from './models/UserModel';
import { QuestList } from './components/QuestList';

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTasks();
    loadUserProfile();
  }, []);

  const loadTasks = async () => {
    try {
      const todayTasks = await DatabaseService.getTodayTasks();
      setTasks(todayTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const loadUserProfile = async () => {
    try {
      const profile = await DatabaseService.getUserProfile();
      setUserProfile(profile);
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  };

  const generateNewTasks = async () => {
    if (!userProfile || loading) return;
    
    setLoading(true);
    try {
      const newTasks = await GeminiService.generatePersonalizedTasks(
        userProfile.dreamSelf,
        userProfile.dreamDescription || userProfile.dreamSelf
      );
      
      for (const task of newTasks) {
        // PersonalizedTaskをTaskに変換
        const taskData = {
          title: task.title,
          description: task.description,
          completed: task.isCompleted,
          createdAt: task.createdAt.toISOString(),
          priority: task.priority <= 2 ? 'high' : task.priority <= 4 ? 'medium' : 'low' as 'high' | 'medium' | 'low'
        };
        await DatabaseService.createTask(taskData);
      }
      
      await loadTasks();
    } catch (error) {
      console.error('Failed to generate tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  };

  const handleTaskToggle = async (taskId: number) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      await DatabaseService.updateTask(taskId, { 
        completed: !task.completed,
        completedAt: !task.completed ? new Date().toISOString() : undefined
      });
      await loadTasks();
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  const completedTasks = tasks.filter(task => task.completed);
  const incompleteTasks = tasks.filter(task => !task.completed);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>✅ タスク</Text>
        <Text style={styles.headerSubtitle}>今日のクエスト</Text>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* タスク生成ボタン */}
        <View style={styles.actionSection}>
          <TouchableOpacity 
            style={[styles.generateButton, loading && styles.generateButtonDisabled]}
            onPress={generateNewTasks}
            disabled={loading || !userProfile}
          >
            <Text style={styles.generateButtonText}>
              {loading ? '⏳ 生成中...' : '✨ 新しいタスクを生成'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 進行中のタスク */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 進行中 ({incompleteTasks.length})</Text>
          {incompleteTasks.length > 0 ? (
            <QuestList 
              tasks={incompleteTasks} 
              onToggleTask={handleTaskToggle}
              dreamSelf={userProfile?.dreamSelf}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>🎉</Text>
              <Text style={styles.emptyStateTitle}>全てのタスク完了！</Text>
              <Text style={styles.emptyStateSubtitle}>新しいタスクを生成してみましょう</Text>
            </View>
          )}
        </View>

        {/* 完了済みタスク */}
        {completedTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✅ 完了済み ({completedTasks.length})</Text>
            <QuestList 
              tasks={completedTasks} 
              onToggleTask={handleTaskToggle}
              dreamSelf={userProfile?.dreamSelf}
            />
          </View>
        )}

        {/* ユーザー目標表示 */}
        {userProfile && (
          <View style={styles.goalSection}>
            <Text style={styles.goalTitle}>🎯 あなたの目標</Text>
            <View style={styles.goalCard}>
              <Text style={styles.goalText}>{userProfile.dreamSelf}</Text>
              {userProfile.dreamDescription && (
                <Text style={styles.goalDescription}>{userProfile.dreamDescription}</Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 20,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  actionSection: {
    marginBottom: 20,
  },
  generateButton: {
    backgroundColor: '#FF9800',
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  generateButtonDisabled: {
    backgroundColor: '#ccc',
  },
  generateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  emptyState: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  goalSection: {
    marginTop: 20,
    marginBottom: 30,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  goalCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  goalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  goalDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
