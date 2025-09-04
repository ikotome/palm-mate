import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
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
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: { backgroundColor: theme.colors.muted, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  tagText: { color: theme.colors.text, fontSize: 12 },
  tagAccent: { backgroundColor: theme.colors.accent, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 },
  tagAccentText: { color: theme.colors.surface, fontSize: 12, fontWeight: '700' },
});
