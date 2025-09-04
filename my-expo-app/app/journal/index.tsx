import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import DatabaseService from '../../services/DatabaseService';
import { Journal } from '../../models/JournalModel';

export default function JournalSummaryScreen() {
  const router = useRouter();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [stats, setStats] = useState<{ totalTasks: number; completedTasks: number }>({ totalTasks: 0, completedTasks: 0 });
  const goToDate = (d: string) => router.push({ pathname: '/journal/[date]' as any, params: { date: d } });

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📖 日記サマリー</Text>
        <Text style={styles.headerSubtitle}>これまでの記録と感情の推移</Text>
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

        {/* ヒートマップ */}
        <View style={styles.heatmapContainer}>
          <Text style={styles.heatmapTitle}>感情ヒートマップ（30日）</Text>
          <View style={styles.heatmapGrid}>
            {last30Days.map(date => {
              const j = journals.find(x => x.date === date);
              const color = j ? getEmotionColor(j.emotion) : '#eee';
        return (
                <TouchableOpacity
                  key={date}
                  style={[styles.heatmapCell, { backgroundColor: color }]}
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#8BC34A', padding: 20, paddingTop: 10 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white', textAlign: 'center' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 4 },
  content: { flex: 1, padding: 15 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: 'white', borderRadius: 12, padding: 16, alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: '#666' },
  summaryValue: { fontSize: 22, fontWeight: '700', color: '#333', marginTop: 4 },
  heatmapContainer: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 16 },
  heatmapTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#333' },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heatmapCell: { width: 22, height: 22, borderRadius: 4 },
  recentSection: { marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  pastJournalCard: { backgroundColor: 'white', borderRadius: 10, padding: 12, marginBottom: 10 },
  journalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  journalDate: { fontSize: 14, fontWeight: '600', color: '#333' },
  emotionBadge: { width: 20, height: 20, borderRadius: 10 },
  journalContentPreview: { fontSize: 14, lineHeight: 20, color: '#444' },
});
