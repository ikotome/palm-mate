import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image, Alert } from 'react-native';
import { theme } from '../styles/theme';
import DatabaseService from '../services/DatabaseService';
import { UserProfile } from '../models/UserModel';
import { OnboardingScreen } from './OnboardingScreen';
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
        <View style={styles.avatarContainer}>
          <Image 
            source={require('../assets/my-image.png')} 
            style={styles.avatarImage}
            resizeMode="contain"
          />
        </View>

        {userProfile && (
          <View style={styles.userInfo}>
            <Text style={styles.greeting}>おかえりなさい！</Text>
            <Text style={styles.dreamText}>目標：{userProfile.dreamSelf}</Text>
          </View>
        )}

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

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.accent,
    marginBottom: 10,
  },
  loadingSubtext: {
    fontSize: 16,
    color: theme.colors.subtext,
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
    color: theme.colors.text,
    marginBottom: 10,
  },
  dreamText: {
    fontSize: 16,
    color: theme.colors.subtext,
    textAlign: 'center',
  },
  actionContainer: {
    width: '100%',
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: theme.colors.text,
    borderRadius: 24,
    paddingVertical: 15,
    paddingHorizontal: 40,
  },
  actionButtonText: {
    color: theme.colors.surface,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
