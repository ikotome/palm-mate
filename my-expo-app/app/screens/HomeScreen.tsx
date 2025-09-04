import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image, Alert, TextInput, Modal, ScrollView } from 'react-native';
import DatabaseService from '../../services/DatabaseService';
import GeminiService from '../../services/GeminiService';
import { UserProfile } from '../../models/UserModel';
import { OnboardingScreen } from '../../components/OnboardingScreen';

export const HomeScreen: React.FC = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showChatModal, setShowChatModal] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{type: 'user' | 'ai', message: string}>>([]);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      await DatabaseService.initializeDatabase();
      const profile = await DatabaseService.getUserProfile();
      
      if (!profile) {
        setShowOnboarding(true);
      } else {
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
      Alert.alert('エラー', 'アプリの初期化に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = async (data: { dreamSelf: string; dreamDescription?: string }) => {
    try {
      await DatabaseService.createUserProfile(data.dreamSelf, data.dreamDescription);
      const profile = await DatabaseService.getUserProfile();
      setUserProfile(profile);
      setShowOnboarding(false);
    } catch (error) {
      console.error('Failed to save user profile:', error);
      Alert.alert('エラー', 'プロファイルの保存に失敗しました');
    }
  };

  const sendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage = currentMessage.trim();
    setCurrentMessage('');
    setChatHistory(prev => [...prev, { type: 'user', message: userMessage }]);

    try {
      // AIからの返答を生成（簡単な例）
      const aiResponse = await generateAIResponse(userMessage);
      setChatHistory(prev => [...prev, { type: 'ai', message: aiResponse }]);

      // 会話をデータベースに保存
      await DatabaseService.saveConversation({
        userId: 'default',
        userMessage: userMessage,
        aiResponse: aiResponse,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('エラー', 'メッセージの送信に失敗しました');
    }
  };

  const generateAIResponse = async (userMessage: string): Promise<string> => {
    // 簡単なAI応答生成（実際にはGeminiServiceを使用）
    const responses = [
      'そうですね！その気持ちよく分かります✨',
      '素晴らしい考えですね！一緒に頑張りましょう💪',
      'なるほど、それは興味深いですね🤔',
      'あなたの成長を感じます！素晴らしいです🌟',
      'そのように考えられるなんて素敵ですね😊'
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>🌟 PalmMate</Text>
          <Text style={styles.loadingSubtext}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* アバター表示エリア */}
        <View style={styles.avatarContainer}>
          <Image 
            source={require('../../assets/images/icon.png')} 
            style={styles.avatarImage}
            resizeMode="contain"
          />
        </View>

        {/* ユーザー情報 */}
        {userProfile && (
          <View style={styles.userInfo}>
            <Text style={styles.greeting}>おかえりなさい！</Text>
            <Text style={styles.dreamText}>目標：{userProfile.dreamSelf}</Text>
          </View>
        )}

        {/* アクションエリア */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setShowChatModal(true)}
          >
            <Text style={styles.actionButtonText}>💬 話しかける</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* チャットモーダル */}
      <Modal
        visible={showChatModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.chatContainer}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle}>アバターとおしゃべり</Text>
            <TouchableOpacity onPress={() => setShowChatModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.chatMessages}>
            {chatHistory.map((msg, index) => (
              <View key={index} style={msg.type === 'user' ? styles.userMessage : styles.aiMessage}>
                <Text style={msg.type === 'user' ? styles.userMessageText : styles.aiMessageText}>
                  {msg.message}
                </Text>
              </View>
            ))}
          </ScrollView>
          
          <View style={styles.chatInput}>
            <TextInput
              style={styles.messageInput}
              value={currentMessage}
              onChangeText={setCurrentMessage}
              placeholder="メッセージを入力..."
              multiline
            />
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <Text style={styles.sendButtonText}>送信</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f8ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 10,
  },
  loadingSubtext: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  avatarContainer: {
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 40,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  dreamText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  actionContainer: {
    width: '100%',
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 25,
    paddingVertical: 15,
    paddingHorizontal: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#f0f8ff',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  closeButton: {
    fontSize: 20,
    color: '#666',
  },
  chatMessages: {
    flex: 1,
    padding: 20,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#4CAF50',
    borderRadius: 15,
    padding: 10,
    marginVertical: 5,
    maxWidth: '80%',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0e0e0',
    borderRadius: 15,
    padding: 10,
    marginVertical: 5,
    maxWidth: '80%',
  },
  userMessageText: {
    color: 'white',
    fontSize: 16,
  },
  aiMessageText: {
    color: '#333',
    fontSize: 16,
  },
  chatInput: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'flex-end',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
