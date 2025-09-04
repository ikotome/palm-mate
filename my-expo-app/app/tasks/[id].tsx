import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { theme } from '../../styles/theme';
import DatabaseService from '../../services/DatabaseService';
import { Task } from '../../models/TaskModel';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const num = Number(id);
    if (Number.isNaN(num)) return;
    const t = await DatabaseService.getTaskById(num);
    setTask(t);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!task) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ padding: 20 }}>
          <Text style={styles.subtext}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{task.title}</Text>
          {task.description ? (
            <Text style={styles.desc}>{task.description}</Text>
          ) : null}
          {/* 状態バッジ */}
          <View style={styles.statusRow}>
            <View style={[styles.badge, task.completed ? styles.badgeDone : task.status === 'skipped' ? styles.badgeSkipped : styles.badgeTodo]}>
              <Text style={[styles.badgeText, task.completed ? styles.badgeTextOn : styles.badgeTextOff]}>
                {task.completed ? '完了' : task.status === 'skipped' ? 'スキップ' : '未完了'}
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.meta}><Text style={styles.metaLabel}>作成:</Text> {new Date(task.createdAt).toLocaleString('ja-JP')}</Text>
            {task.completedAt && (
              <Text style={styles.meta}><Text style={styles.metaLabel}>完了:</Text> {new Date(task.completedAt).toLocaleString('ja-JP')}</Text>
            )}
          </View>
          <View style={styles.tagRow}>
            <View style={styles.tag}><Text style={styles.tagText}>優先度: {task.priority}</Text></View>
            {task.category ? <View style={styles.tag}><Text style={styles.tagText}>カテゴリ: {task.category}</Text></View> : null}
            {task.dueDate ? <View style={styles.tagAccent}><Text style={styles.tagAccentText}>期限: {task.dueDate}</Text></View> : null}
          </View>

          {/* 操作ボタン（一覧ではなく詳細のみ）*/}
          {!task.completed && (
            <View style={styles.actionsRow}>
              {task.status === 'skipped' ? (
                <TouchableOpacity
                  style={[styles.primaryBtn]}
                  onPress={async () => {
                    await DatabaseService.updateTask(task.id, { status: 'todo' });
                    const t = await DatabaseService.getTaskById(task.id);
                    setTask(t);
                  }}
                >
                  <Text style={styles.primaryBtnText}>スキップを解除</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.dangerBtn]}
                  onPress={async () => {
                    await DatabaseService.updateTask(task.id, { status: 'skipped' });
                    const t = await DatabaseService.getTaskById(task.id);
                    setTask(t);
                  }}
                >
                  <Text style={styles.dangerBtnText}>やらなかったにする</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { flex: 1, padding: 16 },
  subtext: { color: theme.colors.subtext },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  desc: { fontSize: 15, color: theme.colors.subtext, lineHeight: 20, marginTop: 2 },
  metaRow: { marginTop: 12 },
  meta: { fontSize: 12, color: theme.colors.subtext, marginTop: 2 },
  metaLabel: { fontWeight: '700', color: theme.colors.text },
  statusRow: { marginTop: 8 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  badgeDone: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  badgeSkipped: { backgroundColor: '#fff1f0', borderColor: '#ffccc7' },
  badgeTodo: { backgroundColor: theme.colors.muted, borderColor: theme.colors.border },
  badgeText: { fontSize: 12 },
  badgeTextOn: { color: theme.colors.surface, fontWeight: '700' },
  badgeTextOff: { color: theme.colors.text, fontWeight: '600' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: { backgroundColor: theme.colors.muted, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  tagText: { color: theme.colors.text, fontSize: 12 },
  tagAccent: { backgroundColor: theme.colors.accent, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 },
  tagAccentText: { color: theme.colors.surface, fontSize: 12, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  primaryBtn: { backgroundColor: theme.colors.text, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  primaryBtnText: { color: theme.colors.surface, fontWeight: '700' },
  dangerBtn: { backgroundColor: '#fff1f0', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#ffccc7' },
  dangerBtnText: { color: '#d4380d', fontWeight: '700' },
});
