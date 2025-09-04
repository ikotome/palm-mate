import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert, Switch, TextInput, Modal, Platform, DevSettings } from 'react-native';
import { theme } from '../styles/theme';
import StackChanService from '../services/StackChanService';
import DatabaseService from '../services/DatabaseService';
import { UserProfile } from '../models/UserModel';

export default function SettingsScreen() {
  const [stackChanConnected, setStackChanConnected] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editDreamSelf, setEditDreamSelf] = useState('');
  const [editDreamDescription, setEditDreamDescription] = useState('');

  useEffect(() => {
    checkStackChanConnection();
    loadUserProfile();
  }, []);

  const checkStackChanConnection = () => {
    const isConnected = StackChanService.getConnectionStatus();
    setStackChanConnected(isConnected);
  };

  const loadUserProfile = async () => {
    try {
      const profile = await DatabaseService.getUserProfile();
      setUserProfile(profile);
      if (profile) {
        setEditDreamSelf(profile.dreamSelf);
        setEditDreamDescription(profile.dreamDescription || '');
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  };

  const saveProfileChanges = async () => {
    if (!userProfile || !editDreamSelf.trim()) {
      Alert.alert('エラー', '憧れの自分を入力してください');
      return;
    }

    try {
      await DatabaseService.updateUserProfile(userProfile.id, {
        dreamSelf: editDreamSelf.trim(),
        dreamDescription: editDreamDescription.trim() || undefined,
      });
      
      await loadUserProfile();
      setShowProfileModal(false);
      Alert.alert('完了', '目標が更新されました！');
    } catch (error) {
      console.error('Failed to update profile:', error);
      Alert.alert('エラー', '更新に失敗しました');
    }
  };

  const testStackChan = async () => {
    try {
      const result = await StackChanService.moveAndGreet();
      if (result.success) {
        Alert.alert('成功', 'StackChanが挨拶しました！');
        setStackChanConnected(true);
      } else {
        Alert.alert('接続エラー', 'StackChanに接続できませんでした');
        setStackChanConnected(false);
      }
    } catch (error) {
      Alert.alert('エラー', 'StackChanのテストに失敗しました');
      setStackChanConnected(false);
    }
  };

  const reconnectStackChan = async () => {
    try {
      await StackChanService.reconnect();
      checkStackChanConnection();
      if (StackChanService.getConnectionStatus()) {
        Alert.alert('成功', 'StackChanに再接続しました！');
      } else {
        Alert.alert('失敗', 'StackChanに接続できませんでした');
      }
    } catch (error) {
      Alert.alert('エラー', '再接続に失敗しました');
    }
  };

  const clearAllData = () => {
    const restartApp = () => {
      if (Platform.OS === 'web') {
        try {
          // @ts-ignore
          if (typeof window !== 'undefined' && window?.location?.reload) {
            // @ts-ignore
            window.location.reload();
            return;
          }
        } catch {}
      }
      try {
        DevSettings.reload();
      } catch {}
    };

    Alert.alert(
      'データ削除確認',
      'データベースを初期化（DROP→CREATE）し、全てのタスク、日記、会話、プロフィール情報が消えます。\nこの操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '削除', 
          style: 'destructive',
          onPress: async () => {
            try {
              // 全データ削除（DROP→CREATE）
              await DatabaseService.resetDatabase();
              Alert.alert('完了', 'データが削除されました。アプリを再起動します。', [
                { text: 'OK', onPress: restartApp }
              ]);
            } catch (error) {
              Alert.alert('エラー', 'データの削除に失敗しました');
            }
          }
        }
      ]
    );
  };

  const seedDummyLast30Days = () => {
    const run = async () => {
      try {
        await DatabaseService.initializeDatabase();
        const { tasks, journals } = await DatabaseService.seedDummyData(360);
        Alert.alert('完了', `ダミーデータを作成しました\nタスク: ${tasks} 件\n日記: ${journals} 件`);
      } catch (e) {
        console.error(e);
        Alert.alert('エラー', 'ダミーデータの作成に失敗しました');
      }
    };

    Alert.alert(
      'ダミーデータ生成',
      '過去360日分のタスクと日記をランダムに作成します。既存の同日日記は上書きされます。よろしいですか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '実行', style: 'default', onPress: run },
      ]
    );
  };

  const appVersion = '1.0.0';
  const buildNumber = '1';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚙️ 設定</Text>
        <Text style={styles.headerSubtitle}>アプリの設定とデバッグ</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* ユーザープロファイル */}
        {userProfile && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>あなたの目標</Text>
            <View style={styles.profileCard}>
              <View style={styles.profileInfo}>
                <Text style={styles.profileLabel}>憧れの自分</Text>
                <Text style={styles.profileValue}>{userProfile.dreamSelf}</Text>
                {userProfile.dreamDescription && (
                  <>
                    <Text style={styles.profileLabel}>詳細</Text>
                    <Text style={styles.profileDescription}>{userProfile.dreamDescription}</Text>
                  </>
                )}
              </View>
              <TouchableOpacity 
                style={styles.editButton} 
                onPress={() => setShowProfileModal(true)}
              >
                <Text style={styles.editButtonText}>✏️ 編集</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* アプリ情報 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アプリ情報</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>PalmMate</Text>
              <Text style={styles.infoValue}>v{appVersion}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ビルド</Text>
              <Text style={styles.infoValue}>{buildNumber}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>React Native + Expo</Text>
              <Text style={styles.infoValue}>🌟</Text>
            </View>
          </View>
        </View>

        {/* AI設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI設定</Text>
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>AI機能</Text>
                <Text style={styles.settingDescription}>Gemini APIを使用</Text>
              </View>
              <Switch
                value={aiEnabled}
                onValueChange={setAiEnabled}
                trackColor={{ false: '#ccc', true: '#4CAF50' }}
              />
            </View>
          </View>
        </View>

        {/* StackChan設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>StackChan連携</Text>
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>接続状態</Text>
                <Text style={[
                  styles.settingDescription,
                  { color: stackChanConnected ? '#4CAF50' : '#F44336' }
                ]}>
                  {stackChanConnected ? '✅ 接続中' : '❌ 未接続'}
                </Text>
              </View>
            </View>
            
            <View style={styles.buttonGroup}>
              <TouchableOpacity style={styles.actionButton} onPress={testStackChan}>
                <Text style={styles.actionButtonText}>動作テスト</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={reconnectStackChan}>
                <Text style={styles.actionButtonText}>再接続</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 通知設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>通知設定</Text>
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>夜間通知</Text>
                <Text style={styles.settingDescription}>22:00に振り返り通知</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#ccc', true: '#4CAF50' }}
              />
            </View>
          </View>
        </View>

        {/* デバッグ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>デバッグ</Text>
          <View style={styles.debugCard}>
            <TouchableOpacity style={styles.debugButton} onPress={clearAllData}>
              <Text style={styles.debugButtonText}>🗑️ 全データ削除</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.debugButton} 
              onPress={seedDummyLast30Days}
            >
              <Text style={styles.debugButtonText}>🧪 過去360日ダミーデータ生成</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* フッター */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Made with ❤️ for your growth
          </Text>
          <Text style={styles.footerSubtext}>
            PalmMateチームより愛を込めて。
          </Text>
        </View>
      </ScrollView>

      {/* プロファイル編集モーダル */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowProfileModal(false)}>
              <Text style={styles.modalCancelText}>キャンセル</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>目標を編集</Text>
            <TouchableOpacity onPress={saveProfileChanges}>
              <Text style={styles.modalSaveText}>保存</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>憧れの自分 *</Text>
            <TextInput
              style={styles.input}
              value={editDreamSelf}
              onChangeText={setEditDreamSelf}
              placeholder="例：健康的で活力に満ちた人"
              multiline
              maxLength={100}
            />
            
            <Text style={styles.inputLabel}>詳細説明（任意）</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={editDreamDescription}
              onChangeText={setEditDreamDescription}
              placeholder="具体的な理由や、どんな風になりたいかなど..."
              multiline
              maxLength={300}
              textAlignVertical="top"
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 10,
  },
  profileCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  profileInfo: {
    marginBottom: 15,
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.subtext,
    marginBottom: 5,
  },
  profileValue: {
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 10,
  },
  profileDescription: {
    fontSize: 14,
    color: theme.colors.subtext,
    lineHeight: 20,
  },
  editButton: {
    backgroundColor: theme.colors.text,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editButtonText: {
    color: theme.colors.surface,
    fontWeight: '600',
    fontSize: 14,
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 16,
    color: theme.colors.text,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.subtext,
  },
  settingCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  settingDescription: {
    fontSize: 14,
    color: theme.colors.subtext,
    marginTop: 2,
  },
  buttonGroup: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: theme.colors.muted,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionButtonText: {
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  debugCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  debugButton: {
    backgroundColor: theme.colors.muted,
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  debugButtonText: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  footerText: {
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 5,
  },
  footerSubtext: {
    fontSize: 14,
    color: theme.colors.subtext,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  modalCancelText: {
    fontSize: 16,
    color: theme.colors.subtext,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.accent,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 20,
  },
  multilineInput: {
    height: 120,
    textAlignVertical: 'top',
  },
});
