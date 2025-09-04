import React, { useEffect, useState, useCallback } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, InteractionManager } from 'react-native';
import { theme } from '../../styles/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DatabaseService from '../../services/DatabaseService';
import { Journal } from '../../models/JournalModel';
import { Task } from '../../models/TaskModel';
import { useFocusEffect } from '@react-navigation/native';
import GeminiService from '../../services/GeminiService';
import Markdown from 'react-native-markdown-display';

export default function JournalDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const [journal, setJournal] = useState<Journal | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [draft, setDraft] = useState('');
  const [showDraft, setShowDraft] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // AI下書きの編集用
  // 既存日記の編集用
  const [isEditingEntry, setIsEditingEntry] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editEmotion, setEditEmotion] = useState<Journal['emotion']>('peaceful');
  const EMOTIONS: Journal['emotion'][] = [
    'happy','excited','peaceful','thoughtful','grateful','determined','confident','curious','content','hopeful','sad','angry','calm','neutral',
  ];

  const startEditExisting = useCallback(() => {
    if (!journal) return;
    setEditContent(journal.content);
    setEditEmotion(journal.emotion);
    setIsEditingEntry(true);
  }, [journal]);

  const cancelEditExisting = useCallback(() => {
    setIsEditingEntry(false);
    setEditContent('');
  }, []);

  const saveEditExisting = useCallback(async () => {
    if (!date || !journal) return;
    const content = editContent.trim();
    if (!content) return;
    setIsGenerating(true);
    try {
      const now = new Date().toISOString();
      await DatabaseService.saveJournal({
        date: String(date),
        title: journal.title,
        content,
        emotion: editEmotion,
        aiGenerated: false, // 手動編集
        createdAt: journal.createdAt, // 既存の作成日時を維持
        updatedAt: now,
      });
      const j = await DatabaseService.getJournalByDate(String(date));
      setJournal(j);
      setIsEditingEntry(false);
    } finally {
      setIsGenerating(false);
    }
  }, [date, journal, editContent, editEmotion]);

  useEffect(() => {
    if (!date) return;
    const task = InteractionManager.runAfterInteractions(() => {
      const load = async () => {
        const [j, t] = await Promise.all([
          DatabaseService.getJournalByDate(String(date)),
          DatabaseService.getCompletedTasksByDate(String(date)),
        ]);
        setJournal(j);
        setTasks(t);
      };
      load();
    });
    return () => task.cancel?.();
  }, [date]);

  // フォーカス時にも再取得
  useFocusEffect(
    useCallback(() => {
      if (!date) return;
      let canceled = false;
      (async () => {
        const [j, t] = await Promise.all([
          DatabaseService.getJournalByDate(String(date)),
          DatabaseService.getCompletedTasksByDate(String(date)),
        ]);
        if (!canceled) {
          setJournal(j);
          setTasks(t);
        }
      })();
      return () => { canceled = true; };
    }, [date])
  );

  const generateDraft = useCallback(async () => {
    if (!date) return;
    setIsGenerating(true);
    try {
      const day = String(date);
      const convs = await DatabaseService.getTodaysConversations(day);
      const convTexts = convs.map(c => `ユーザー: ${c.userMessage}\nAI: ${c.aiResponse}`);
      const dayTasks = await DatabaseService.getCompletedTasksByDate(day);
      const aiText = await GeminiService.generateJournalEntry(convTexts, dayTasks);
      setDraft(aiText);
      setShowDraft(true);
      setIsEditing(false);
    } finally {
      setIsGenerating(false);
    }
  }, [date]);

  const saveDraft = useCallback(async () => {
    if (!date || !draft.trim()) return;
    setIsGenerating(true);
    try {
      const day = String(date);
      const emotionRaw = await GeminiService.analyzeEmotion(draft);
      const validEmotions = ['happy','excited','peaceful','thoughtful','grateful','determined','confident','curious','content','hopeful','sad','angry','calm','neutral'] as const;
      const emotion = (validEmotions as readonly string[]).includes(emotionRaw as any) ? (emotionRaw as any) : 'peaceful';
      await DatabaseService.saveJournal({
        date: day,
        title: `${day}の振り返り`,
        content: draft.trim(),
        emotion,
        aiGenerated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const j = await DatabaseService.getJournalByDate(day);
      setJournal(j);
      setShowDraft(false);
      setIsEditing(false);
    } finally {
      setIsGenerating(false);
    }
  }, [date, draft]);

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
                <View style={styles.journalHeaderRight}>
                  <View style={[styles.emotionBadge, { backgroundColor: getEmotionColor(isEditingEntry ? editEmotion : journal.emotion) }]} />
                  {!isEditingEntry && (
                    <TouchableOpacity style={styles.secondaryBtnSm} onPress={startEditExisting}>
                      <Text style={styles.secondaryBtnSmText}>編集</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {isEditingEntry ? (
                <View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emotionsRow}>
                    {EMOTIONS.map((e) => (
                      <TouchableOpacity
                        key={e}
                        style={[styles.emotionChip, e === editEmotion && styles.emotionChipActive]}
                        onPress={() => setEditEmotion(e)}
                      >
                        <View style={[styles.emotionDot, { backgroundColor: getEmotionColor(e) }]} />
                        <Text style={[styles.emotionChipText, e === editEmotion && styles.emotionChipTextActive]}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TextInput
                    style={styles.draftInput}
                    value={editContent}
                    onChangeText={setEditContent}
                    multiline
                    editable={!isGenerating}
                    maxLength={1200}
                  />
                  <View style={styles.draftButtonsRow}>
                    <TouchableOpacity style={styles.secondaryBtn} disabled={isGenerating} onPress={cancelEditExisting}>
                      <Text style={styles.secondaryBtnText}>キャンセル</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.primaryBtn} disabled={isGenerating || !editContent.trim()} onPress={saveEditExisting}>
                      <Text style={styles.primaryBtnText}>保存</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <Markdown style={mdStyles}>{journal.content}</Markdown>
                  {journal.aiGenerated && <Text style={styles.aiLabel}>🤖 AI生成</Text>}
                </>
              )}
            </View>
          ) : (
            <View style={styles.noJournalCard}>
              <Text style={styles.noJournalText}>この日の日記はありません</Text>
              {!showDraft ? (
                <TouchableOpacity style={styles.primaryBtn} disabled={isGenerating} onPress={generateDraft}>
                  <Text style={styles.primaryBtnText}>{isGenerating ? '生成中...' : 'AI下書きを作る'}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.draftCard}>
                  <Text style={styles.draftTitle}>AI日記の下書き</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.draftInput}
                      value={draft}
                      onChangeText={setDraft}
                      multiline
                      editable={!isGenerating}
                      maxLength={1200}
                    />
                  ) : (
                    <Markdown style={mdStyles}>{draft}</Markdown>
                  )}
                  <View style={styles.draftButtonsRow}>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={() => setIsEditing(e => !e)}>
                      <Text style={styles.secondaryBtnText}>{isEditing ? '編集をやめる' : '編集する'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryBtn} disabled={isGenerating} onPress={generateDraft}>
                      <Text style={styles.secondaryBtnText}>再生成</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.primaryBtn} disabled={isGenerating || !draft.trim()} onPress={saveDraft}>
                      <Text style={styles.primaryBtnText}>保存する</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dangerBtn} disabled={isGenerating} onPress={() => { setShowDraft(false); setDraft(''); setIsEditing(false); }}>
                      <Text style={styles.dangerBtnText}>破棄</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { backgroundColor: theme.colors.surface, padding: 20, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text, textAlign: 'center' },
  headerSubtitle: { fontSize: 14, color: theme.colors.subtext, textAlign: 'center', marginTop: 4 },
  content: { padding: 15, paddingBottom: 24 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: 10 },
  journalCard: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  journalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  journalDate: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  emotionBadge: { width: 20, height: 20, borderRadius: 10 },
  journalContent: { fontSize: 16, lineHeight: 24, color: theme.colors.text },
  aiLabel: { fontSize: 12, color: theme.colors.subtext, marginTop: 8, textAlign: 'right' },
  noJournalCard: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  noJournalText: { color: theme.colors.subtext },
  taskCard: { backgroundColor: theme.colors.surface, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  taskTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  taskDesc: { fontSize: 14, color: theme.colors.subtext, marginTop: 4 },
  noTasksText: { color: theme.colors.subtext },
  // draft/ui
  draftCard: { marginTop: 12, width: '100%' },
  draftTitle: { fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  draftText: { color: theme.colors.text, fontSize: 16, lineHeight: 24 },
  draftInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 10, minHeight: 120, maxHeight: 320, color: theme.colors.text },
  draftButtonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  primaryBtn: { backgroundColor: theme.colors.text, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginTop: 10 },
  primaryBtnText: { color: theme.colors.surface, fontWeight: '600' },
  secondaryBtn: { backgroundColor: theme.colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginTop: 10 },
  secondaryBtnText: { color: theme.colors.text, fontWeight: '600' },
  dangerBtn: { backgroundColor: '#fff1f0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#ffccc7', marginTop: 10 },
  dangerBtnText: { color: '#d4380d', fontWeight: '600' },
  // existing journal edit UI
  journalHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  secondaryBtnSm: { backgroundColor: theme.colors.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, marginLeft: 8 },
  secondaryBtnSmText: { color: theme.colors.text, fontWeight: '600', fontSize: 12 },
  emotionsRow: { gap: 8, paddingVertical: 4, paddingBottom: 8 },
  emotionChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, marginRight: 6 },
  emotionChipActive: { backgroundColor: theme.colors.text + '11', borderColor: theme.colors.text },
  emotionChipText: { color: theme.colors.subtext, textTransform: 'capitalize' },
  emotionChipTextActive: { color: theme.colors.text, fontWeight: '700' },
  emotionDot: { width: 10, height: 10, borderRadius: 5 },
});

// Markdownスタイル
const mdStyles: any = {
  body: {
    color: theme.colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  paragraph: {
    marginTop: 4,
    marginBottom: 8,
  },
  heading1: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 8,
    color: theme.colors.text,
  },
  heading2: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 6,
    color: theme.colors.text,
  },
  heading3: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 4,
    color: theme.colors.text,
  },
  list_item: {
    color: theme.colors.text,
  },
  bullet_list: {
    marginVertical: 6,
  },
  ordered_list: {
    marginVertical: 6,
  },
  code_inline: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontFamily: 'SpaceMono-Regular',
    color: theme.colors.text,
  },
  fence: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontFamily: 'SpaceMono-Regular',
    color: theme.colors.text,
    lineHeight: 22,
    marginVertical: 8,
  },
  code_block: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontFamily: 'SpaceMono-Regular',
    color: theme.colors.text,
    lineHeight: 22,
    marginVertical: 8,
  },
  link: {
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
  strong: {
    fontWeight: '700',
  },
  em: {
    fontStyle: 'italic',
  },
  blockquote: {
    borderLeftColor: theme.colors.border,
    borderLeftWidth: 4,
    paddingLeft: 10,
    color: theme.colors.subtext,
  },
};
