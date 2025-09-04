import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { theme } from '../styles/theme';
import DatabaseService from '../services/DatabaseService';
import GeminiService from '../services/GeminiService';
import { Task } from '../models/TaskModel';
import { UserProfile } from '../models/UserModel';
import { QuestList } from '../components/QuestList';

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
  loadTasks();
  loadUserProfile();
  ensureDailyTasks();
    // 初回ロード時に多すぎる場合は5件に整理
    (async () => {
      try {
        const count = await DatabaseService.getTodaysTasksCount();
        if (count > 5) {
          await DatabaseService.pruneTodayTasks(5);
          await loadTasks();
        }
      } catch {}
    })();
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
    if (loading) return;
    
    setLoading(true);
    try {
      const goal = userProfile?.dreamSelf || '今の自分を少し良くする';
      const desc = userProfile?.dreamDescription || goal;
      // 文脈収集
      const recentConvs = (await DatabaseService.getRecentConversations(10)).map(c => `ユーザー: ${c.userMessage}\nAI: ${c.aiResponse}`);
      const todayExisting = (await DatabaseService.getTodayTasks()).map(t => t.title);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yyyymmdd = yesterday.toISOString().split('T')[0];
      const yCompleted = (await DatabaseService.getCompletedTasksByDate(yyyymmdd)).map(t => t.title);

      const concrete = await GeminiService.generateConcretePersonalizedTasks({
        userGoal: goal,
        dreamDescription: desc,
        recentConversations: recentConvs,
        existingTodayTitles: todayExisting,
        recentCompletedTitles: yCompleted,
        targetCount: 5,
      });
      
      for (const task of concrete) {
        // PersonalizedTaskをTaskに変換
        const taskData = {
          title: task.title,
          description: task.description,
          completed: false,
          createdAt: new Date().toISOString(),
          priority: (task.priority || 'medium') as 'high' | 'medium' | 'low'
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

  // 1日1回の自動生成: 目安5個。既に今日のタスクがあれば不足分のみ補充。
  const ensureDailyTasks = async () => {
    try {
  const profile = await DatabaseService.getUserProfile();
      const todayCount = await DatabaseService.getTodaysTasksCount();
      const target = 5; // 目安個数
      let toCreate = 0;
      if (todayCount >= target) return; // 既に十分
      if (todayCount === 0) {
        // 初回は必ず5件用意（前日達成があれば今後の難易度調整に活用予定）
        toCreate = target;
      } else {
        toCreate = target - todayCount;
      }
      if (toCreate <= 0) return;

      // Geminiから候補を取得し、必要数のみ追加
  const goal = profile?.dreamSelf || '今の自分を少し良くする';
  const desc = profile?.dreamDescription || goal;
  const candidates = await GeminiService.generatePersonalizedTasks(goal, desc);
      let selected = candidates.slice(0, Math.max(0, toCreate));
      // 候補が少ない場合はサンプルを繰り返し補充
      while (selected.length < toCreate) {
        const more = await GeminiService.generatePersonalizedTasks(goal, desc);
        selected = selected.concat(more).slice(0, toCreate);
        if (more.length === 0) break; // 念のため無限ループ防止
      }
      for (const t of selected) {
        await DatabaseService.createTask({
          title: t.title,
          description: t.description,
          completed: false,
          createdAt: new Date().toISOString(),
          priority: t.priority <= 2 ? 'high' : t.priority <= 4 ? 'medium' : 'low',
        });
      }
      await loadTasks();
    } catch (e) {
      console.warn('ensureDailyTasks failed:', e);
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
            onPress={async () => { await ensureDailyTasks(); await generateNewTasks(); }}
            disabled={loading}
          >
            <Text style={styles.generateButtonText}>
              {loading ? '⏳ 生成中...' : '✨ 新しいタスクを生成'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.pruneButton]}
            onPress={async () => { await DatabaseService.pruneTodayTasks(5); await loadTasks(); }}
          >
            <Text style={styles.pruneButtonText}>🧹 今日のタスクを5件に整理</Text>
          </TouchableOpacity>
        </View>

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
        {/* 今日のクエスト一覧（ページ表示） */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 今日のクエスト</Text>
          <QuestList
            tasks={tasks}
            onToggleTask={handleTaskToggle}
            dreamSelf={userProfile?.dreamSelf}
            variant="page"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.subtext,
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
    backgroundColor: theme.colors.text,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: 'transparent',
  },
  generateButtonDisabled: {
    backgroundColor: '#ccc',
  },
  generateButtonText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: 'bold',
  },
  pruneButton: {
    backgroundColor: theme.colors.muted,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pruneButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
  },
  goalSection: {
    marginTop: 20,
    marginBottom: 30,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
  },
  goalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  goalText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  goalDescription: {
    fontSize: 14,
    color: theme.colors.subtext,
    lineHeight: 20,
  },
});
