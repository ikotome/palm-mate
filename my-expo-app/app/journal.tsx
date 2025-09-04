import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Journal } from '../models/JournalModel';
import { Task } from '../models/TaskModel';
import DatabaseService from '../services/DatabaseService';
import GeminiService from '../services/GeminiService';

export default function JournalScreen() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [todaysJournal, setTodaysJournal] = useState<Journal | null>(null);
  const [isGeneratingJournal, setIsGeneratingJournal] = useState(false);
  const [summary, setSummary] = useState<{ totalTasks: number; totalCompletedTasks: number; totalJournals: number } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [selectedCompletedTasks, setSelectedCompletedTasks] = useState<Task[]>([]);
  const [loadingSelectedDay, setLoadingSelectedDay] = useState(false);

  useEffect(() => {
    loadJournals();
  }, []);

  const loadJournals = async () => {
    try {
      const allJournals = await DatabaseService.getJournals();
      setJournals(allJournals);
      
      const today = new Date().toISOString().split('T')[0];
      const todayJournal = allJournals.find(j => j.date === today);
      setTodaysJournal(todayJournal || null);

      const totals = await DatabaseService.getTotals();
      setSummary(totals);
    } catch (error) {
      console.error('Failed to load journals:', error);
    }
  };

  const generateTodaysJournal = async () => {
    try {
      setIsGeneratingJournal(true);
      
      // 今日のタスクを取得
      const todaysTasks = await DatabaseService.getTasks();
      
      // 今日の会話データを取得
      const todaysConversations = await DatabaseService.getTodaysConversations();
      const conversationTexts = todaysConversations.map(conv => 
        `ユーザー: ${conv.userMessage}\nAI: ${conv.aiResponse}`
      );
      
      // AIで日記を生成（会話データを含む）
      const journalContent = await GeminiService.generateJournalEntry(conversationTexts, todaysTasks);
      const emotion = await GeminiService.analyzeEmotion(journalContent);
      
      // 有効な感情値にフォールバック
      const validEmotions = ['happy', 'excited', 'peaceful', 'thoughtful', 'grateful', 'determined', 'confident', 'curious', 'content', 'hopeful', 'sad', 'angry', 'calm', 'neutral'] as const;
      const finalEmotion = (validEmotions as readonly string[]).includes(emotion as any) ? (emotion as Journal['emotion']) : 'peaceful';
      
      const today = new Date().toISOString().split('T')[0];
      const newJournal: Omit<Journal, 'id'> = {
        date: today,
        title: `${today}の振り返り`,
        content: journalContent,
        emotion: finalEmotion,
        aiGenerated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      await DatabaseService.saveJournal(newJournal);
      await loadJournals();
      
      Alert.alert('日記完了！', '今日の日記が生成されました✨');
    } catch (error) {
      console.error('Failed to generate journal:', error);
      Alert.alert('エラー', '日記の生成に失敗しました');
    } finally {
      setIsGeneratingJournal(false);
    }
  };

  const getEmotionColor = (emotion: Journal['emotion']) => {
    switch (emotion) {
      case 'happy': return '#4CAF50';
      case 'excited': return '#FF9800';
      case 'calm': return '#2196F3';
      case 'sad': return '#9C27B0';
      case 'angry': return '#F44336';
      default: return '#757575';
    }
  };

  const getEmotionEmoji = (emotion: Journal['emotion']) => {
    switch (emotion) {
      case 'happy': return '😊';
      case 'excited': return '🤩';
      case 'calm': return '😌';
      case 'sad': return '😢';
      case 'angry': return '😠';
      default: return '😐';
    }
  };

  const last30Days = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });
  }, []);

  const handleSelectDate = async (date: string) => {
    setSelectedDate(date);
    setLoadingSelectedDay(true);
    try {
      const [j, tasks] = await Promise.all([
        DatabaseService.getJournalByDate(date),
        DatabaseService.getCompletedTasksForDate(date),
      ]);
      setSelectedJournal(j);
      setSelectedCompletedTasks(tasks);
    } catch (e) {
      console.error('Failed to load selected day details', e);
      Alert.alert('読み込みエラー', '選択日のデータ取得に失敗しました');
    } finally {
      setLoadingSelectedDay(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📖 日記</Text>
        <Text style={styles.headerSubtitle}>あなたの成長記録</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* サマリー */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>これまでのサマリー</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>作成タスク</Text>
              <Text style={styles.summaryValue}>{summary?.totalTasks ?? 0}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>完了タスク</Text>
              <Text style={styles.summaryValue}>{summary?.totalCompletedTasks ?? 0}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>日記</Text>
              <Text style={styles.summaryValue}>{summary?.totalJournals ?? 0}</Text>
            </View>
          </View>
        </View>

        {/* 今日のAI日記生成ボタン（必要時のみ） */}
        {!todaysJournal && (
          <View style={[styles.todaySection, { marginTop: 0 }] }>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>今日の振り返り</Text>
              <TouchableOpacity
                style={[styles.generateButton, isGeneratingJournal && styles.generateButtonDisabled]}
                onPress={generateTodaysJournal}
                disabled={isGeneratingJournal}
              >
                <Text style={styles.generateButtonText}>
                  {isGeneratingJournal ? 'AI生成中...' : 'AI日記生成'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.noJournalCard}>
              <Text style={styles.noJournalText}>今日の日記はまだありません</Text>
              <Text style={styles.noJournalSubtext}>AIに振り返りを生成してもらいましょう！</Text>
            </View>
          </View>
        )}

        {/* 感情ヒートマップ */}
        <View style={styles.heatmapContainer}>
          <Text style={styles.heatmapTitle}>感情ヒートマップ（30日間）</Text>
          <View style={styles.heatmapGrid}>
            {last30Days.map((date) => {
              const journal = journals.find(j => j.date === date);
              const color = journal ? getEmotionColor(journal.emotion) : '#f0f0f0';
              const isSelected = selectedDate === date;
              return (
                <TouchableOpacity
                  key={date}
                  onPress={() => handleSelectDate(date)}
                  activeOpacity={0.8}
                  style={[
                    styles.heatmapCell,
                    { backgroundColor: color, borderWidth: isSelected ? 2 : 0, borderColor: '#333' },
                  ]}
                />
              );
            })}
          </View>
        </View>

        {/* 選択日の詳細 */}
        {selectedDate && (
          <View style={styles.detailCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{selectedDate} の記録</Text>
              <TouchableOpacity onPress={() => { setSelectedDate(null); setSelectedJournal(null); setSelectedCompletedTasks([]); }}>
                <Text style={styles.clearLink}>クリア</Text>
              </TouchableOpacity>
            </View>

            {loadingSelectedDay ? (
              <Text style={styles.loadingText}>読み込み中...</Text>
            ) : (
              <>
                {/* 日記 */}
                {selectedJournal ? (
                  <View style={styles.journalCard}>
                    <View style={styles.journalHeader}>
                      <Text style={styles.journalDate}>{selectedJournal.date}</Text>
                      <View style={[styles.emotionBadge, { backgroundColor: getEmotionColor(selectedJournal.emotion) }]}>
                        <Text style={styles.emotionEmoji}>{getEmotionEmoji(selectedJournal.emotion)}</Text>
                      </View>
                    </View>
                    <Text style={styles.journalContent}>{selectedJournal.content}</Text>
                    {selectedJournal.aiGenerated && (
                      <Text style={styles.aiLabel}>🤖 AI生成</Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.noPastJournalsText}>この日の日記はありません</Text>
                )}

                {/* 完了タスク */}
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.sectionTitle}>完了したタスク</Text>
                  {selectedCompletedTasks.length > 0 ? (
                    selectedCompletedTasks.map(t => (
                      <View key={t.id} style={styles.taskRow}>
                        <Text style={styles.taskBullet}>•</Text>
                        <Text style={styles.taskText}>{t.title}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noPastJournalsText}>完了タスクはありません</Text>
                  )}
                </View>
              </>
            )}
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
    backgroundColor: '#8BC34A',
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
  todaySection: {
    marginBottom: 25,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  generateButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  generateButtonDisabled: {
    backgroundColor: '#ccc',
  },
  generateButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  journalCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  noJournalCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 30,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  noJournalText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  noJournalSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  journalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  journalDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  emotionBadge: {
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  emotionEmoji: {
    fontSize: 16,
  },
  journalContent: {
    fontSize: 16,
    lineHeight: 24,
    color: '#444',
  },
  aiLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 10,
    textAlign: 'right',
  },
  heatmapContainer: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
  },
  heatmapTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  heatmapCell: {
    width: 20,
    height: 20,
    borderRadius: 3,
  },
  noPastJournalsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
  },
  detailCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  loadingText: {
    color: '#666',
  },
  clearLink: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  taskBullet: {
    width: 16,
    color: '#666',
  },
  taskText: {
    flex: 1,
    color: '#444',
  },
});
