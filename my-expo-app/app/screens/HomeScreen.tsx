import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image, Alert } from 'react-native';
import DatabaseService from '../../services/DatabaseService';
import { UserProfile } from '../../models/UserModel';
import { OnboardingScreen } from '../../components/OnboardingScreen';
import { useRouter } from 'expo-router';

export const HomeScreen: React.FC = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
            source={require('../../assets/my-image.png')} 
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
            onPress={() => router.push('/chat')}
          >
            <Text style={styles.actionButtonText}>💬 話しかける</Text>
          </TouchableOpacity>
        </View>
      </View>
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
});
