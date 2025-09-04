import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DatabaseService from '../../services/DatabaseService';
import { Journal } from '../../models/JournalModel';
import { Task } from '../../models/TaskModel';

export default function JournalDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const [journal, setJournal] = useState<Journal | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!date) return;
    const load = async () => {
      const [j, t] = await Promise.all([
        DatabaseService.getJournalByDate(String(date)),
        DatabaseService.getCompletedTasksByDate(String(date)),
      ]);
      setJournal(j);
      setTasks(t);
    };
    load();
  }, [date]);

  const getEmotionColor = (emotion: Journal['emotion']) => {
    switch (emotion) {
      case 'happy': return '#4CAF50';
      case 'excited': return '#FF9800';
      case 'calm': return '#2196F3';
      case 'sad': return '#9C27B0';
      case 'angry': return '#F44336';
      case 'peaceful': return '#66BB6A';
      case 'thoughtful': return '#42A5F5';
      case 'grateful': return '#FFB300';
      case 'determined': return '#8E24AA';
      case 'confident': return '#26A69A';
      case 'curious': return '#29B6F6';
      case 'content': return '#7CB342';
      case 'hopeful': return '#AB47BC';
      case 'neutral': return '#757575';
      default: return '#757575';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🗓️ {String(date)}</Text>
        <Text style={styles.headerSubtitle}>その日の日記とタスク</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 日記 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>日記</Text>
          {journal ? (
            <View style={styles.journalCard}>
              <View style={styles.journalHeader}>
                <Text style={styles.journalDate}>{journal.date}</Text>
                <View style={[styles.emotionBadge, { backgroundColor: getEmotionColor(journal.emotion) }]} />
              </View>
              <Text style={styles.journalContent}>{journal.content}</Text>
              {journal.aiGenerated && <Text style={styles.aiLabel}>🤖 AI生成</Text>}
            </View>
          ) : (
            <View style={styles.noJournalCard}>
              <Text style={styles.noJournalText}>この日の日記はありません</Text>
            </View>
          )}
        </View>

        {/* タスク */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>完了したタスク</Text>
          {tasks.length > 0 ? (
            tasks.map(t => (
              <View key={t.id} style={styles.taskCard}>
                <Text style={styles.taskTitle}>✅ {t.title}</Text>
                {t.description ? <Text style={styles.taskDesc}>{t.description}</Text> : null}
              </View>
            ))
          ) : (
            <Text style={styles.noTasksText}>この日に完了したタスクはありません</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#8BC34A', padding: 20, paddingTop: 10 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white', textAlign: 'center' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 4 },
  content: { padding: 15, paddingBottom: 24 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  journalCard: { backgroundColor: 'white', borderRadius: 12, padding: 16 },
  journalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  journalDate: { fontSize: 14, fontWeight: '600', color: '#333' },
  emotionBadge: { width: 20, height: 20, borderRadius: 10 },
  journalContent: { fontSize: 16, lineHeight: 24, color: '#444' },
  aiLabel: { fontSize: 12, color: '#666', marginTop: 8, textAlign: 'right' },
  noJournalCard: { backgroundColor: 'white', borderRadius: 12, padding: 24, alignItems: 'center' },
  noJournalText: { color: '#666' },
  taskCard: { backgroundColor: 'white', borderRadius: 10, padding: 12, marginBottom: 8 },
  taskTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  taskDesc: { fontSize: 14, color: '#666', marginTop: 4 },
  noTasksText: { color: '#666' },
});
