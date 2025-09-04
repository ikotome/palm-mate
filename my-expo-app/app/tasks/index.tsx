import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, RefreshControl, InteractionManager, Modal, Pressable } from 'react-native';
import { theme } from '../../styles/theme';
import DatabaseService from '../../services/DatabaseService';
import GeminiService from '../../services/GeminiService';
import { Task } from '../../models/TaskModel';
import { UserProfile } from '../../models/UserModel';
import { QuestList } from '../../components/QuestList';
import { useFocusEffect } from '@react-navigation/native';
import { jstDateString } from '../../utils/time';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'incomplete' | 'completed'>('all');
  const [sort, setSort] = useState<'priority' | 'due' | 'created'>('priority');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  useEffect(() => {
    loadTasks();
    loadUserProfile();
    const task = InteractionManager.runAfterInteractions(async () => {
      await ensureDailyTasks();
      try {
        const count = await DatabaseService.getTodaysTasksCount();
        if (count > 5) {
          await DatabaseService.pruneTodayTasks(5);
          await loadTasks();
        }
      } catch {}
    });
    return () => task.cancel?.();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
      loadUserProfile();
      return undefined;
    }, [])
  );

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
      const recentConvs = (await DatabaseService.getRecentConversations(10)).map(c => `ユーザー: ${c.userMessage}\nAI: ${c.aiResponse}`);
      const todayExisting = (await DatabaseService.getTodayTasks()).map(t => t.title);
      const todayJst = jstDateString();
      const base = new Date(`${todayJst}T00:00:00+09:00`);
      base.setUTCDate(base.getUTCDate() - 1);
      const yyyymmdd = jstDateString(new Date(base));
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
        const taskData = {
          title: task.title,
          description: task.description,
          completed: false,
          createdAt: new Date().toISOString(),
          priority: (task.priority || 'medium') as 'high' | 'medium' | 'low',
          dueDate: task.dueDate,
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

  const ensureDailyTasks = async () => {
    try {
      const profile = await DatabaseService.getUserProfile();
      const todayCount = await DatabaseService.getTodaysTasksCount();
      const target = 5;
      let toCreate = 0;
      if (todayCount >= target) return;
      if (todayCount === 0) {
        toCreate = target;
      } else {
        toCreate = target - todayCount;
      }
      if (toCreate <= 0) return;

      const goal = profile?.dreamSelf || '今の自分を少し良くする';
      const desc = profile?.dreamDescription || goal;
      const candidates = await GeminiService.generatePersonalizedTasks(goal, desc);
      let selected = candidates.slice(0, Math.max(0, toCreate));
      while (selected.length < toCreate) {
        const more = await GeminiService.generatePersonalizedTasks(goal, desc);
        selected = selected.concat(more).slice(0, toCreate);
        if (more.length === 0) break;
      }
      for (const t of selected) {
        await DatabaseService.createTask({
          title: t.title,
          description: t.description,
          completed: false,
          createdAt: new Date().toISOString(),
          priority: t.priority <= 2 ? 'high' : t.priority <= 4 ? 'medium' : 'low',
          dueDate: undefined,
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

  const handlePressTask = (task: Task) => {
    router.push(`/tasks/${task.id}`);
  };

  const handleQuickSkip = async (task: Task) => {
    try {
      const nextStatus = task.status === 'skipped' ? 'todo' : 'skipped';
      await DatabaseService.updateTask(task.id, { status: nextStatus });
      await Haptics.selectionAsync();
      await loadTasks();
    } catch (e) {
      console.error('Failed to quick-skip:', e);
    }
  };

  const sortTasks = useCallback((arr: Task[]) => {
    const priorityOrder: Record<Task['priority'], number> = { high: 0, medium: 1, low: 2 };
    return [...arr].sort((a, b) => {
      if (sort === 'priority') {
        const p = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (p !== 0) return p;
        // 同順位の場合は期限→作成日の順
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        if (ad !== bd) return ad - bd;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sort === 'due') {
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        if (ad !== bd) return ad - bd;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      // created
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [sort]);

  const displayedTasks = useMemo(() => {
    let arr = tasks;
    if (filter === 'incomplete') arr = tasks.filter(t => !t.completed);
    if (filter === 'completed') arr = tasks.filter(t => t.completed);
    return sortTasks(arr);
  }, [tasks, filter, sortTasks]);

  const filterLabel = useMemo(() => (
    filter === 'all' ? 'すべて' : filter === 'incomplete' ? '未完了' : '完了'
  ), [filter]);
  const sortLabel = useMemo(() => (
    sort === 'priority' ? '優先度' : sort === 'due' ? '期限' : '作成順'
  ), [sort]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>✅ タスク</Text>
        <Text style={styles.headerSubtitle}>今日のクエスト</Text>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.actionSection}>
          <TouchableOpacity 
            style={[styles.generateButton, loading && styles.generateButtonDisabled]}
            onPress={async () => { await generateNewTasks(); }}
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

        {/* フィルタ/ソート（中央揃えドロップダウン） */}
        <View style={styles.filterBar}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={async () => { setShowFilterMenu(true); await Haptics.selectionAsync(); }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.menuButtonText}>フィルター: {filterLabel} ▼</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={async () => { setShowSortMenu(true); await Haptics.selectionAsync(); }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.menuButtonText}>ソート: {sortLabel} ▼</Text>
          </TouchableOpacity>
        </View>

        {/* フィルタメニュー */}
        <Modal transparent visible={showFilterMenu} animationType="fade" onRequestClose={() => setShowFilterMenu(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowFilterMenu(false)}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>フィルター</Text>
              {([
                { key: 'all', label: 'すべて' },
                { key: 'incomplete', label: '未完了' },
                { key: 'completed', label: '完了' },
              ] as const).map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.modalOption, filter === c.key && styles.modalOptionActive]}
                  onPress={async () => {
                    setFilter(c.key);
                    await Haptics.selectionAsync();
                    setShowFilterMenu(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* ソートメニュー */}
        <Modal transparent visible={showSortMenu} animationType="fade" onRequestClose={() => setShowSortMenu(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowSortMenu(false)}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>ソート</Text>
              {([
                { key: 'priority', label: '優先度' },
                { key: 'due', label: '期限' },
                { key: 'created', label: '作成順' },
              ] as const).map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.modalOption, sort === c.key && styles.modalOptionActive]}
                  onPress={async () => {
                    setSort(c.key);
                    await Haptics.selectionAsync();
                    setShowSortMenu(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>

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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 今日のクエスト</Text>
          <QuestList
            tasks={displayedTasks}
            onToggleTask={handleTaskToggle}
            dreamSelf={userProfile?.dreamSelf}
            variant="page"
            onPressTask={handlePressTask}
            onLongPressQuickSkip={handleQuickSkip}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { backgroundColor: theme.colors.surface, padding: 20, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text, textAlign: 'center' },
  headerSubtitle: { fontSize: 14, color: theme.colors.subtext, textAlign: 'center', marginTop: 4 },
  content: { flex: 1, padding: 15 },
  contentContainer: { paddingBottom: 120 },
  actionSection: { marginBottom: 20 },
  generateButton: { backgroundColor: theme.colors.text, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', shadowColor: 'transparent' },
  generateButtonDisabled: { backgroundColor: '#ccc' },
  generateButtonText: { color: theme.colors.surface, fontSize: 16, fontWeight: 'bold' },
  pruneButton: { backgroundColor: theme.colors.muted, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: theme.colors.border },
  pruneButtonText: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  filterBar: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  menuButton: { backgroundColor: theme.colors.muted, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.colors.border, marginHorizontal: 6 },
  menuButtonText: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: theme.colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text, marginBottom: 10 },
  modalOption: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.muted },
  modalOptionActive: { backgroundColor: theme.colors.accent },
  modalOptionText: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: 12 },
  goalSection: { marginTop: 20, marginBottom: 30 },
  goalTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: 12 },
  goalCard: { backgroundColor: theme.colors.surface, borderRadius: 15, padding: 20, borderWidth: 1, borderColor: theme.colors.border },
  goalText: { fontSize: 16, fontWeight: '600', color: theme.colors.text, marginBottom: 8 },
  goalDescription: { fontSize: 14, color: theme.colors.subtext, lineHeight: 20 },
});
