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
  const [greeting, setGreeting] = useState<string>('');
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
  const g = await generateGreeting(profile);
  setGreeting(g);
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
      const g = await generateGreeting(profile);
      setGreeting(g);
    } catch (error) {
      console.error('Failed to save user profile:', error);
      Alert.alert('エラー', 'プロファイルの保存に失敗しました');
    }
  };

  // 挨拶メッセージを時間帯・進捗などから生成
  const generateGreeting = async (profile: UserProfile | null): Promise<string> => {
    try {
      const now = new Date();
      const hour = now.getHours();
      const timeOfDay =
        hour < 5 ? 'lateNight' :
        hour < 11 ? 'morning' :
        hour < 17 ? 'afternoon' :
        hour < 22 ? 'evening' : 'night';

      const base: Record<string, string[]> = {
        lateNight: ['夜更かしさん、こんばんは🌙', '静かな時間、深呼吸していこう', '無理せず休むのもだいじだよ'],
        morning: ['おはようございます☀️', '今日のスタート、一緒にいこう！', 'いい朝になる予感！'],
        afternoon: ['こんにちは！', '午後もコツコツいこう💪', 'ひと休みも忘れずにね'],
        evening: ['おかえりなさい！', '今日もおつかれさま🌆', 'ゆっくり振り返る時間にしよう'],
        night: ['こんばんは🌙', '一日おつかれさま', 'あとは流れに身を任せていこう']
      };

      const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

      // コンテキスト情報
      const [todayCount, yDone, startDate] = await Promise.all([
        DatabaseService.getTodaysTasksCount().catch(() => 0),
        DatabaseService.getYesterdayCompletedCount().catch(() => 0),
        DatabaseService.getAppStartDate().catch(() => new Date().toISOString().split('T')[0])
      ]);

      // 経過日数
      let daysSince = 0;
      try {
        const s = new Date(startDate);
        daysSince = Math.max(0, Math.floor((now.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      } catch {}

      const contextual: string[] = [];
      if (profile?.dreamSelf) {
        contextual.push(`目標「${profile.dreamSelf}」に向けて、今日も一歩ずつ🧭`);
      }
      if (todayCount > 0) {
        contextual.push(`今日は${todayCount}件のタスクが待ってるよ`);
        contextual.push('まずはひとつだけ片付けてみよう');
      } else {
        contextual.push('今日はタスクはゼロ。心の栄養を満たす日にしよう');
      }
      if (yDone >= 3) {
        contextual.push(`昨日は${yDone}件も達成！いい流れだね🔥`);
      } else if (yDone === 0) {
        contextual.push('昨日はお休みモード。今日は軽めにいこう');
      }
      if (daysSince === 1) {
        contextual.push('はじめまして！ここから一緒に育てていこう');
      } else if ([3, 7, 14, 30].includes(daysSince)) {
        contextual.push(`PalmMate生活${daysSince}日目、おめでとう🎉`);
      }

  const candidates = [...base[timeOfDay], ...contextual];
  return pick(candidates.filter(Boolean));
    } catch {
      return 'おかえりなさい！';
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
      <Text style={styles.greeting}>{greeting || 'おかえりなさい！'}</Text>
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
