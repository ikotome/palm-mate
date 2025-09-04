import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import GeminiService from '../services/GeminiService';
import DatabaseService from '../services/DatabaseService';
import { useRouter } from 'expo-router';

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export default function ChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // 夜の振り返り用状態
  const [isReflecting, setIsReflecting] = useState(false);
  const [reflectionStep, setReflectionStep] = useState(0);
  const [isGeneratingJournal, setIsGeneratingJournal] = useState(false);
  const [reflectionStarted, setReflectionStarted] = useState(false);

  const reflectionQuestions = [
    { id: 'good', text: '今日は何がうまくいきましたか？1つ教えてください。' },
    { id: 'challenge', text: '難しかったことや頑張ったことは何ですか？' },
    { id: 'highlight', text: '今日のハイライト（嬉しかったこと）は？' },
    { id: 'next', text: '明日の自分に一言や意識したいことは？' },
  ] as const;

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
    // 夜なら日記の振り返りを提案
    (async () => {
      const hour = new Date().getHours();
      if (hour < 19) return; // 19時以降に提案
      const today = new Date().toISOString().split('T')[0];
      try {
        const existing = await DatabaseService.getJournalByDate(today);
        if (!existing && !reflectionStarted) {
          setReflectionStarted(true);
          const intro: ChatMessage = {
            id: 'reflect-intro',
            text: 'そろそろ1日の振り返りを一緒にしませんか？短い質問に答えると、AIが“今日のあなた”をギュッとまとめた日記を書きます📝',
            isUser: false,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, intro]);

          // 最初の質問を投げる
          const q: ChatMessage = {
            id: `reflect-q-0`,
            text: `Q1. ${reflectionQuestions[0].text}\n（スキップする場合は「スキップ」と入力してください）`,
            isUser: false,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, q]);
          setIsReflecting(true);
          setReflectionStep(0);
        }
      } catch (e) {
        // 失敗時は黙って通常モード
      }
    })();
  }, []);

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
    
  // 振り返りモード中の処理
    if (isReflecting) {
      const raw = userMessage.text.trim();
      // 日本語は lowerCase で壊れることがあるのでそのまま判定
      if (raw.includes('スキップ') || /skip/i.test(raw) || raw.includes('後で')) {
        setIsReflecting(false);
        setReflectionStep(0);
        const cancelMsg: ChatMessage = {
          id: (Date.now() + 99).toString(),
          text: 'また後で振り返りしましょうね。いつでも「振り返りしよう」と話しかけてください 😊',
          isUser: false,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, cancelMsg]);
        return;
      }

      // 次の質問 or 生成
      const nextStep = reflectionStep + 1;
      if (nextStep < reflectionQuestions.length) {
        const nextQ = reflectionQuestions[nextStep];
        // 会話ログ保存（ユーザー回答 -> 次の質問）
        try {
          await DatabaseService.saveConversation({
            userId: 'default',
            userMessage: userMessage.text,
            aiResponse: `Q${nextStep + 1}. ${nextQ.text}`,
            timestamp: new Date().toISOString(),
          });
        } catch {}
        const bot: ChatMessage = {
          id: (Date.now() + 2).toString(),
          text: `Q${nextStep + 1}. ${nextQ.text}`,
          isUser: false,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, bot]);
        setReflectionStep(nextStep);
      } else {
        // 回答が揃ったのでAI日記生成
        setIsGeneratingJournal(true);
        try {
          // 最後のユーザー回答も保存しておく
          try {
            await DatabaseService.saveConversation({
              userId: 'default',
              userMessage: userMessage.text,
              aiResponse: 'ありがとう。日記を生成するね。',
              timestamp: new Date().toISOString(),
            });
          } catch {}
          // 直近のチャットからユーザー/AIの文脈を抽出
          const todaysConversations = await DatabaseService.getTodaysConversations();
          const convTexts = todaysConversations.map(c => `ユーザー: ${c.userMessage}\nAI: ${c.aiResponse}`);
          const todaysTasks = await DatabaseService.getTasks();

          const aiText = await GeminiService.generateJournalEntry(convTexts, todaysTasks);
          const emotionRaw = await GeminiService.analyzeEmotion(aiText);
          const validEmotions = ['happy','excited','peaceful','thoughtful','grateful','determined','confident','curious','content','hopeful','sad','angry','calm','neutral'] as const;
          const emotion = (validEmotions as readonly string[]).includes(emotionRaw) ? (emotionRaw as any) : 'peaceful';

          const today = new Date().toISOString().split('T')[0];
          await DatabaseService.saveJournal({
            date: today,
            title: `${today}の振り返り`,
            content: aiText,
            emotion,
            aiGenerated: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          const doneMsg: ChatMessage = {
            id: (Date.now() + 3).toString(),
            text: '📝 今日のAI日記を保存しました。ヒートマップや日記ページからいつでも見返せます！',
            isUser: false,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, doneMsg]);
          // 保存後に当日のジャーナル画面へ遷移
          router.push(`/journal/${today}`);
        } catch (e) {
          const errMsg: ChatMessage = {
            id: (Date.now() + 4).toString(),
            text: '日記の生成に失敗しました。時間をおいてもう一度お試しください。',
            isUser: false,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errMsg]);
        } finally {
          setIsGeneratingJournal(false);
          setIsReflecting(false);
          setReflectionStep(0);
        }
      }
      return;
    }

    // 手動で振り返り開始
  const trigger = userMessage.text;
    if (!isReflecting && (trigger.includes('振り返り') || trigger.includes('日記'))) {
      const q0 = reflectionQuestions[0];
      const bot: ChatMessage = {
        id: (Date.now() + 5).toString(),
        text: `Q1. ${q0.text}`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, bot]);
      setIsReflecting(true);
      setReflectionStep(0);
      try {
        await DatabaseService.saveConversation({
          userId: 'default',
          userMessage: userMessage.text,
          aiResponse: `Q1. ${q0.text}`,
          timestamp: new Date().toISOString(),
        });
      } catch {}
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

      // === タスク自動抽出・作成（明示的な意図がある時のみ） ===
      try {
        const intent = userMessage.text;
        const wantsTasks = /(タスク|TODO|やること|計画|プラン|スケジュール)/.test(intent) || /箇条書き|リスト/.test(intent);
        if (wantsTasks) {
          const extracted = await GeminiService.extractTasksFromText(
            userMessage.text,
            aiResponse,
            context ? `過去のメッセージ:\n${context}` : ''
          );

          if (extracted && extracted.length > 0) {
            const createdTitles: string[] = [];
            for (const t of extracted) {
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
            }

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
  );

  return (
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
        showsVerticalScrollIndicator={false}
      />

      {isLoading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>AI が考え中...</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4CAF50',
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
    backgroundColor: '#4CAF50',
    alignSelf: 'flex-end',
  },
  aiMessage: {
    backgroundColor: 'white',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: 'white',
  },
  aiMessageText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.5)',
    marginTop: 4,
    textAlign: 'right',
  },
  loadingContainer: {
    padding: 15,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  debugButton: {
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  debugButtonText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
});
