import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { theme } from '../styles/theme';
import GeminiService from '../services/GeminiService';
import DatabaseService from '../services/DatabaseService';
import { useRouter } from 'expo-router';
import { jstDateString } from '../utils/time';

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  // 特殊レンダリング用のタイプ（draftは下書き用カードを表示）
  type?: 'draft';
}

export default function ChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // 日記下書きレビュー用状態
  const [isGeneratingJournal, setIsGeneratingJournal] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftDate, setDraftDate] = useState<string | null>(null);
  const [isDraftVisible, setIsDraftVisible] = useState(false);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [draftPrompted, setDraftPrompted] = useState(false); // 夜の自動提案が二重起動しないように
  const draftMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    // 初回にウェルカムメッセージを表示
    setMessages([
      {
        id: 'welcome',
        text: 'こんにちは！今日はどんなことを話しましょうか？😊',
        isUser: false,
        timestamp: new Date(),
      },
    ]);
    // 夜なら「質問」ではなく「自動下書き生成→レビュー」を提案
    (async () => {
      const hour = new Date().getHours();
      if (hour < 19) return; // 19時以降に提案
      const today = jstDateString();
      try {
        const existing = await DatabaseService.getJournalByDate(today);
        if (!existing && !draftPrompted) {
          setDraftPrompted(true);
          const intro: ChatMessage = {
            id: 'draft-intro',
            text: 'そろそろ1日の振り返りを自動でまとめます。会話とタスクから日記の下書きを作るので、内容を確認して保存してください。',
            isUser: false,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, intro]);
          await startJournalDraftFlow('auto');
        }
      } catch (e) {
        // 失敗時は黙って通常モード
      }
    })();
  }, []);

  // 下書きフロー開始（自動/手動）
  const startJournalDraftFlow = async (trigger: 'auto' | 'manual') => {
    try {
      setIsGeneratingJournal(true);
      setIsLoading(true);
      const today = jstDateString();
      setDraftDate(today);

      // 既存日記チェック（手動でも重複保存を避ける）
      const existing = await DatabaseService.getJournalByDate(today);
      if (existing) {
        const msg: ChatMessage = {
          id: 'already-exists-' + Date.now(),
          text: '今日はすでに日記があります。内容を見直す場合は日記ページから編集してください。',
          isUser: false,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, msg]);
        return;
      }

      // 文脈収集
      const todaysConversations = await DatabaseService.getTodaysConversations(today);
      const convTexts = todaysConversations.map(c => `ユーザー: ${c.userMessage}\nAI: ${c.aiResponse}`);
      const todaysTasks = await DatabaseService.getTasks();

      // 生成
      const aiText = await GeminiService.generateJournalEntry(convTexts, todaysTasks);
      setDraftText(aiText);
      setIsDraftVisible(true);
      setIsEditingDraft(false);

      // 表示用のドラフト・メッセージを差し込む（本文は state から描画）
      const draftMsg: ChatMessage = {
        id: 'draft-' + Date.now().toString(),
        text: '',
        isUser: false,
        timestamp: new Date(),
        type: 'draft',
      };
      draftMessageIdRef.current = draftMsg.id;
      setMessages(prev => [...prev, draftMsg]);
    } finally {
      setIsGeneratingJournal(false);
      setIsLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!draftDate || !draftText.trim()) return;
    setIsLoading(true);
    try {
      const emotionRaw = await GeminiService.analyzeEmotion(draftText);
      const validEmotions = ['happy','excited','peaceful','thoughtful','grateful','determined','confident','curious','content','hopeful','sad','angry','calm','neutral'] as const;
      const emotion = (validEmotions as readonly string[]).includes(emotionRaw as any) ? (emotionRaw as any) : 'peaceful';

      await DatabaseService.saveJournal({
        date: draftDate,
        title: `${draftDate}の振り返り`,
        content: draftText.trim(),
        emotion,
        aiGenerated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const doneMsg: ChatMessage = {
        id: 'draft-saved-' + Date.now(),
        text: '📝 日記の下書きを保存しました。いつでも見返せます。',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, doneMsg]);
      clearDraft();
      router.push(`/journal/${draftDate}`);
    } catch (e) {
      const errMsg: ChatMessage = {
        id: 'draft-save-error-' + Date.now(),
        text: '日記の保存に失敗しました。時間をおいて再度お試しください。',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateDraft = async () => {
    if (!draftDate) return;
    setIsLoading(true);
    try {
      const todaysConversations = await DatabaseService.getTodaysConversations(draftDate);
      const convTexts = todaysConversations.map(c => `ユーザー: ${c.userMessage}\nAI: ${c.aiResponse}`);
      const todaysTasks = await DatabaseService.getTasks();
      const aiText = await GeminiService.generateJournalEntry(convTexts, todaysTasks);
      setDraftText(aiText);
      setIsEditingDraft(false);
    } finally {
      setIsLoading(false);
    }
  };

  const clearDraft = () => {
    setIsDraftVisible(false);
    setIsEditingDraft(false);
    setDraftText('');
    setDraftDate(null);
    if (draftMessageIdRef.current) {
      setMessages(prev => prev.filter(m => m.id !== draftMessageIdRef.current));
      draftMessageIdRef.current = null;
    }
  };

  const sendMessage = async (textOverride?: string) => {
    const payload = (textOverride ?? inputText).trim();
    if (!payload || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: payload,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    // 手動で日記の下書きを生成（キーワード: 振り返り/日記/レビュー）
    const trigger = userMessage.text;
    if (trigger.includes('振り返り') || trigger.includes('日記') || trigger.includes('レビュー')) {
      const bot: ChatMessage = {
        id: (Date.now() + 5).toString(),
        text: '今日の会話とタスクから日記の下書きを作ります。少しお待ちください。',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, bot]);
      await startJournalDraftFlow('manual');
      return;
    }

    // タスク調整の簡易検出（例: タスク名・優先度の変更を要望）
  if (/(タスク.*(変えて|変更|修正)|きつ|大変|重い)/.test(userMessage.text)) {
      try {
        const todayTasks = await DatabaseService.getTodayTasks();
        const target = todayTasks.find(t => !t.completed) || todayTasks[0];
        if (target) {
          // ざっくりした調整: タイトル末尾に(調整)を付け、優先度を一段下げる
          const newPriority = target.priority === 'high' ? 'medium' : target.priority === 'medium' ? 'low' : 'low';
          await DatabaseService.updateTask(target.id, {
            title: target.title.endsWith('(調整)') ? target.title : `${target.title} (調整)`,
            priority: newPriority,
          });
          const confirm: ChatMessage = {
            id: (Date.now() + 12).toString(),
            text: `了解です。直近のタスクを少し軽くしました（優先度: ${newPriority}）。必要なら具体的に「タイトルを◯◯に」「説明を◯◯に」と伝えてください。`,
            isUser: false,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, confirm]);
          await DatabaseService.saveConversation({
            userId: 'default',
            userMessage: userMessage.text,
            aiResponse: confirm.text,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      } catch (e) {
        // 無視
      }
    }

    setIsLoading(true);

  try {
      const context = messages
        .slice(-3)
        .map(m => `${m.isUser ? 'ユーザー' : 'AI'}: ${m.text}`)
        .join('\n');

      const aiResponse = await GeminiService.generateChatResponse(
        userMessage.text,
        context ? `過去のメッセージ:\n${context}` : undefined
      );

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: aiResponse,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);

      // DB保存
      await DatabaseService.saveConversation({
        userId: 'default',
        userMessage: userMessage.text,
        aiResponse: aiResponse,
        timestamp: new Date().toISOString(),
      });

      // === タスク自動完了検出・反映 ===
      try {
        const todayTasks = await DatabaseService.getTodayTasks();
        const titles = todayTasks.map(t => t.title);
        const detectedDone = await GeminiService.detectCompletedTasksFromText(
          userMessage.text,
          aiResponse,
          titles
        );
        if (detectedDone.length > 0) {
          const titleSet = new Set(detectedDone);
          let updatedCount = 0;
          for (const t of todayTasks) {
            if (!t.completed && titleSet.has(t.title)) {
              await DatabaseService.updateTask(t.id, { completed: true });
              updatedCount++;
            }
          }
          if (updatedCount > 0) {
            const confirm: ChatMessage = {
              id: (Date.now() + 7).toString(),
              text: `✅ ${updatedCount}件のタスクを完了にしました:\n- ${detectedDone.join('\n- ')}`,
              isUser: false,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, confirm]);
          }
        }
      } catch (autoDoneErr) {
        // 検出失敗は致命的でないので無視
      }

      // === タスク自動抽出・作成（AIが抽出できたとき自動作成） ===
      try {
        const extracted = await GeminiService.extractTasksFromText(
          userMessage.text,
          aiResponse,
          context ? `過去のメッセージ:\n${context}` : ''
        );

        if (extracted && extracted.length > 0) {
          const createdTitles: string[] = [];
          // 同日重複タイトルを回避（既存+今回生成分を含むSet）
          const existingSet = new Set(
            (await DatabaseService.getTodayTasks()).map(tt => tt.title.trim().toLowerCase())
          );
          for (const t of extracted) {
            const key = (t.title || '').trim().toLowerCase();
            if (!key || existingSet.has(key)) continue;
            const createdAt = new Date().toISOString();
            await DatabaseService.addTask({
              title: t.title,
              description: t.description,
              category: t.category,
              priority: t.priority,
              completed: false,
              createdAt,
            });
            createdTitles.push(t.title);
            existingSet.add(key);
          }

          if (createdTitles.length > 0) {
            const summaryMessage: ChatMessage = {
              id: (Date.now() + 2).toString(),
              text: `📝 ${createdTitles.length}件のタスクを追加しました:\n- ${createdTitles.join('\n- ')}`,
              isUser: false,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, summaryMessage]);
          }
        }
      } catch (extractErr) {
        // 抽出失敗は致命的ではないためログのみ
        console.warn('Task extraction failed:', extractErr);
      }
    } catch (error) {
  const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: 'すみません、今はお返事できません。少し時間をおいてもう一度試してください。',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View>
      {item.type === 'draft' && isDraftVisible ? (
        <View style={[styles.messageContainer, styles.aiMessage]}>
          <Text style={[styles.messageText, styles.aiMessageText, { fontWeight: '700', marginBottom: 6 }]}>AI日記の下書き</Text>
          {isEditingDraft ? (
            <TextInput
              style={[styles.draftInput]}
              value={draftText}
              onChangeText={setDraftText}
              multiline
              maxLength={1200}
              placeholder="日記の内容を編集..."
              editable={!isLoading}
            />
          ) : (
            <Text style={[styles.messageText, styles.aiMessageText]}>{draftText}</Text>
          )}
          <View style={styles.draftButtonsRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setIsEditingDraft(e => !e)}>
              <Text style={styles.secondaryBtnText}>{isEditingDraft ? '編集をやめる' : '編集する'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleRegenerateDraft}>
              <Text style={styles.secondaryBtnText}>再生成</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveDraft}>
              <Text style={styles.primaryBtnText}>保存する</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerBtn} onPress={clearDraft}>
              <Text style={styles.dangerBtnText}>破棄</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.timestamp}>
            {item.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      ) : (
        <View style={[
          styles.messageContainer,
          item.isUser ? styles.userMessage : styles.aiMessage
        ]}>
          <Text style={[
            styles.messageText,
            item.isUser ? styles.userMessageText : styles.aiMessageText
          ]}>
            {item.text}
          </Text>
          <Text style={styles.timestamp}>
            {item.timestamp.toLocaleTimeString('ja-JP', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
        <Text style={styles.headerTitle}>💬 AIチャット</Text>
        <Text style={styles.headerSubtitle}>何でも話しかけてくださいね</Text>
        {__DEV__ && (
          <TouchableOpacity
            onPress={() =>
              sendMessage(
                'TODO: 牛乳を買う\n・家計簿をつける\n1) 本を10分読む\n- 写真バックアップ\nやること: メール返信'
              )
            }
            style={styles.debugButton}
          >
            <Text style={styles.debugButtonText}>🧪 タスク抽出テスト</Text>
          </TouchableOpacity>
        )}
        </View>

        <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        />

        {isLoading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>AI が考え中...</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="メッセージを入力..."
            multiline
            maxLength={500}
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={() => sendMessage()}
            disabled={!inputText.trim() || isLoading}
          >
            <Text style={styles.sendButtonText}>送信</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
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
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 15,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  userMessage: {
  backgroundColor: theme.colors.accent,
    alignSelf: 'flex-end',
  },
  aiMessage: {
  backgroundColor: theme.colors.surface,
    alignSelf: 'flex-start',
  borderWidth: 1,
  borderColor: theme.colors.border,
  },
  draftInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 10,
    minHeight: 120,
    maxHeight: 300,
    color: theme.colors.text,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: 'white',
  },
  aiMessageText: {
  color: theme.colors.text,
  },
  draftButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: theme.colors.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: theme.colors.surface,
    fontWeight: '600',
  },
  secondaryBtn: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryBtnText: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  dangerBtn: {
    backgroundColor: '#fff1f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffccc7',
  },
  dangerBtnText: {
    color: '#d4380d',
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
  color: theme.colors.subtext,
    marginTop: 4,
    textAlign: 'right',
  },
  loadingContainer: {
    padding: 15,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  color: theme.colors.subtext,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
  backgroundColor: theme.colors.surface,
  borderTopWidth: 1,
  borderTopColor: theme.colors.border,
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
  borderWidth: 1,
  borderColor: theme.colors.border,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
  backgroundColor: theme.colors.text,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
  color: theme.colors.surface,
    fontWeight: '600',
    fontSize: 16,
  },
  debugButton: {
    alignSelf: 'center',
    marginTop: 8,
  backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  debugButtonText: {
  color: theme.colors.accent,
    fontWeight: '600',
  },
});
