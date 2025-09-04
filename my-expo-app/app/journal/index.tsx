import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { theme } from '../../styles/theme';
import { useRouter } from 'expo-router';
import DatabaseService from '../../services/DatabaseService';
import { Journal } from '../../models/JournalModel';

export default function JournalSummaryScreen() {
  const router = useRouter();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [stats, setStats] = useState<{ totalTasks: number; completedTasks: number }>({ totalTasks: 0, completedTasks: 0 });
  const goToDate = (d: string) => router.push({ pathname: '/journal/[date]' as any, params: { date: d } });
  // 日毎の完了タスク数
  const [dailyCounts, setDailyCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      const [js, s] = await Promise.all([
        DatabaseService.getJournals(),
        DatabaseService.getTaskStats(),
      ]);
      setJournals(js);
      setStats(s);
    };
    load();
  }, []);

  const last30Days = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().split('T')[0];
  }), []);

  // 直近30日の完了タスク数を取得
  useEffect(() => {
    let mounted = true;
    const loadDailyCounts = async () => {
      const entries = await Promise.all(
        last30Days.map(async (date) => {
          const tasks = await DatabaseService.getCompletedTasksByDate(date);
          return [date, tasks.length] as const;
        })
      );
      if (!mounted) return;
      const map: Record<string, number> = {};
      for (const [d, c] of entries) map[d] = c;
      setDailyCounts(map);
    };
    loadDailyCounts();
    return () => { mounted = false; };
  }, [last30Days]);

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

  const totalDays = journals.length;
  const positiveDays = journals.filter(j => ['happy','excited','peaceful','grateful','confident','content','hopeful','calm','determined'].includes(j.emotion)).length;
  const journalDates = useMemo(() => new Set(journals.map(j => j.date)), [journals]);

  // タスク数に応じた色（0=グレー、1~薄緑、増えるほど濃く）
  const getCountColor = (count: number) => {
    if (count >= 7) return '#04a609';
    if (count >= 6) return '#1daf22';
    if (count >= 5) return '#36b83a';
    if (count >= 4) return '#4fc153';
    if (count >= 3) return '#68ca6b';
    if (count >= 2) return '#82d384';
    if (count >= 1) return '#9bdb9d';
    return '#e6f6e6';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📖 日記サマリー</Text>
        <Text style={styles.headerSubtitle}>これまでの記録と進捗の推移</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* サマリカード */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>累計タスク</Text>
            <Text style={styles.summaryValue}>{stats.totalTasks}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>完了タスク</Text>
            <Text style={styles.summaryValue}>{stats.completedTasks}</Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}> 
            <Text style={styles.summaryLabel}>日記総数</Text>
            <Text style={styles.summaryValue}>{totalDays}</Text>
          </View>
          <View style={styles.summaryCard}> 
            <Text style={styles.summaryLabel}>前向きな日</Text>
            <Text style={styles.summaryValue}>{positiveDays}</Text>
          </View>
        </View>

        {/* ヒートマップ（完了タスク数 × 日記有無） */}
        <View style={styles.heatmapContainer}>
          <Text style={styles.heatmapTitle}>進捗ヒートマップ（30日）</Text>
          <View style={styles.heatmapGrid}>
            {last30Days.map(date => {
              const count = dailyCounts[date] ?? 0;
              const hasJournal = journalDates.has(date);
              const color = getCountColor(count);
              return (
                <TouchableOpacity
                  key={date}
                  style={[
                    styles.heatmapCell,
                    { backgroundColor: color },
                    hasJournal ? styles.heatmapCellWithJournal : null,
                  ]}
                  onPress={() => goToDate(date)}
                />
              );
            })}
          </View>
        </View>

        {/* 最近の日記のプレビュー */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>最近の日記</Text>
          {journals.slice(0, 5).map(j => (
            <TouchableOpacity key={j.id} style={styles.pastJournalCard} onPress={() => goToDate(j.date)}>
              <View style={styles.journalHeader}>
                <Text style={styles.journalDate}>{j.date}</Text>
                <View style={[styles.emotionBadge, { backgroundColor: getEmotionColor(j.emotion) }]} />
              </View>
              <Text style={styles.journalContentPreview} numberOfLines={2}>{j.content}</Text>
            </TouchableOpacity>
          ))}
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
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  summaryLabel: { fontSize: 12, color: theme.colors.subtext },
  summaryValue: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginTop: 4 },
  heatmapContainer: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border },
  heatmapTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: theme.colors.text },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heatmapCell: { width: 22, height: 22, borderRadius: 4 },
  heatmapCellWithJournal: { borderWidth: 2, borderColor: theme.colors.text },
  recentSection: { marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.text, marginBottom: 8 },
  pastJournalCard: { backgroundColor: theme.colors.surface, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  journalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  journalDate: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  emotionBadge: { width: 20, height: 20, borderRadius: 10 },
  journalContentPreview: { fontSize: 14, lineHeight: 20, color: theme.colors.text },
});
