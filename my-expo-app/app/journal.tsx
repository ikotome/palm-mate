import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Journal } from './models/JournalModel';
import DatabaseService from './services/DatabaseService';
import GeminiService from './services/GeminiService';

export default function JournalScreen() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [todaysJournal, setTodaysJournal] = useState<Journal | null>(null);
  const [isGeneratingJournal, setIsGeneratingJournal] = useState(false);

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
      const finalEmotion = validEmotions.includes(emotion as any) ? emotion as Journal['emotion'] : 'peaceful';
      
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
      
      Alert.alert('日記完成！', '今日の日記が生成されました✨');
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

  // ヒートマップカレンダー（簡易版）
  const renderHeatmap = () => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    return (
      <View style={styles.heatmapContainer}>
        <Text style={styles.heatmapTitle}>感情ヒートマップ（30日間）</Text>
        <View style={styles.heatmapGrid}>
          {last30Days.map((date) => {
            const journal = journals.find(j => j.date === date);
            const color = journal ? getEmotionColor(journal.emotion) : '#f0f0f0';
            
            return (
              <View
                key={date}
                style={[
                  styles.heatmapCell,
                  { backgroundColor: color }
                ]}
              />
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📖 日記</Text>
        <Text style={styles.headerSubtitle}>あなたの成長記録</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 今日の日記セクション */}
        <View style={styles.todaySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>今日の振り返り</Text>
            {!todaysJournal && (
              <TouchableOpacity
                style={[styles.generateButton, isGeneratingJournal && styles.generateButtonDisabled]}
                onPress={generateTodaysJournal}
                disabled={isGeneratingJournal}
              >
                <Text style={styles.generateButtonText}>
                  {isGeneratingJournal ? 'AI生成中...' : 'AI日記生成'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {todaysJournal ? (
            <View style={styles.journalCard}>
              <View style={styles.journalHeader}>
                <Text style={styles.journalDate}>{todaysJournal.date}</Text>
                <View style={[styles.emotionBadge, { backgroundColor: getEmotionColor(todaysJournal.emotion) }]}>
                  <Text style={styles.emotionEmoji}>{getEmotionEmoji(todaysJournal.emotion)}</Text>
                </View>
              </View>
              <Text style={styles.journalContent}>{todaysJournal.content}</Text>
              {todaysJournal.aiGenerated && (
                <Text style={styles.aiLabel}>🤖 AI生成</Text>
              )}
            </View>
          ) : (
            <View style={styles.noJournalCard}>
              <Text style={styles.noJournalText}>今日の日記はまだありません</Text>
              <Text style={styles.noJournalSubtext}>AIに振り返りを生成してもらいましょう！</Text>
            </View>
          )}
        </View>

        {/* ヒートマップ */}
        {renderHeatmap()}

        {/* 過去の日記 */}
        <View style={styles.pastJournalsSection}>
          <Text style={styles.sectionTitle}>過去の日記</Text>
          {journals.length > 0 ? (
            journals.slice(0, 5).map((journal) => (
              <View key={journal.id} style={styles.pastJournalCard}>
                <View style={styles.journalHeader}>
                  <Text style={styles.journalDate}>{journal.date}</Text>
                  <View style={[styles.emotionBadge, { backgroundColor: getEmotionColor(journal.emotion) }]}>
                    <Text style={styles.emotionEmoji}>{getEmotionEmoji(journal.emotion)}</Text>
                  </View>
                </View>
                <Text style={styles.journalContentPreview} numberOfLines={2}>
                  {journal.content}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.noPastJournalsText}>まだ日記がありません</Text>
          )}
        </View>
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
  pastJournalsSection: {
    marginBottom: 20,
  },
  pastJournalCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  journalContentPreview: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  noPastJournalsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
  },
});
