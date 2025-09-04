import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert, Switch, TextInput, Modal } from 'react-native';
import StackChanService from './services/StackChanService';
import DatabaseService from './services/DatabaseService';
import { UserProfile } from './models/UserModel';

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
    Alert.alert(
      'データ削除確認',
      '全てのタスクと日記データが削除されます。この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '削除', 
          style: 'destructive',
          onPress: async () => {
            try {
              // データベースを再初期化（全データ削除）
              await DatabaseService.initializeDatabase();
              Alert.alert('完了', 'データが削除されました');
            } catch (error) {
              Alert.alert('エラー', 'データの削除に失敗しました');
            }
          }
        }
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
              onPress={() => Alert.alert('開発中', 'この機能は開発中です')}
            >
              <Text style={styles.debugButtonText}>📊 ログ確認</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.debugButton} 
              onPress={() => Alert.alert('開発中', 'この機能は開発中です')}
            >
              <Text style={styles.debugButtonText}>🔄 キャッシュクリア</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* フッター */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Made with ❤️ for your growth
          </Text>
          <Text style={styles.footerSubtext}>
            たまごっち風の成長アプリ
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FF9800',
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
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
  },
  profileInfo: {
    marginBottom: 15,
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 5,
  },
  profileValue: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  profileDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  editButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 16,
    color: '#333',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  settingCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
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
    color: '#333',
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  buttonGroup: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  debugCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
  },
  debugButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  debugButtonText: {
    fontSize: 16,
    color: '#495057',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  footerText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  footerSubtext: {
    fontSize: 14,
    color: '#999',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 20,
  },
  multilineInput: {
    height: 120,
    textAlignVertical: 'top',
  },
});
