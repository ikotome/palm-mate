import React, { useState } from 'react';
import { FlatList, View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { theme } from '../styles/theme';
import { Task } from '../models/TaskModel';
import { QuestItem } from './QuestItem';

interface QuestListProps {
  tasks: Task[];
  onToggleTask: (taskId: number) => void;
  dreamSelf?: string;
  variant?: 'drawer' | 'page';
  onPressTask?: (task: Task) => void;
  onLongPressQuickSkip?: (task: Task) => void;
}

const { height } = Dimensions.get('window');

export const QuestList: React.FC<QuestListProps> = ({ tasks, onToggleTask, dreamSelf, variant = 'drawer', onPressTask, onLongPressQuickSkip }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [slideAnim] = useState(new Animated.Value(0));

  const toggleDrawer = () => {
    const toValue = isExpanded ? 0 : 1;
    setIsExpanded(!isExpanded);
    
    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const completedTasks = tasks.filter(task => task.completed);
  const incompleteTasks = tasks.filter(task => !task.completed);

  if (variant === 'page') {
    // ページ表示: 絶対配置やドロワーではなく、通常のレイアウトで一覧を表示
    if (tasks.length === 0) {
      return (
        <View style={styles.pageEmptyContainer}>
          <Text style={styles.emptyEmoji}>📝</Text>
          <Text style={styles.emptyText}>今日のクエストはまだありません</Text>
          <Text style={styles.emptySubtext}>上の「新しいタスクを生成」を押してみましょう</Text>
        </View>
      );
    }

    return (
      <View style={styles.pageContainer}>
        <View style={styles.pageHeader}>
          <Text style={styles.drawerTitle}>今日のクエスト一覧</Text>
          {dreamSelf && (
            <Text style={styles.dreamText} numberOfLines={1}>
              目標: {dreamSelf}
            </Text>
          )}
        </View>

        {/* 未完了タスク */}
        {incompleteTasks.length > 0 && (
          <View style={styles.taskSection}>
            <Text style={styles.sectionTitle}>
              🎯 やること ({incompleteTasks.length}個)
            </Text>
            <FlatList
              data={incompleteTasks}
              keyExtractor={(item) => `incomplete-${item.id}`}
              renderItem={({ item }) => (
                <QuestItem task={item} onToggle={onToggleTask} onPress={onPressTask} onLongPressQuickSkip={onLongPressQuickSkip} />
              )}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* 完了済みタスク */}
        {completedTasks.length > 0 && (
          <View style={styles.taskSection}>
            <Text style={styles.sectionTitle}>
              ✅ 完了済み ({completedTasks.length}個)
            </Text>
            <FlatList
              data={completedTasks}
              keyExtractor={(item) => `completed-${item.id}`}
              renderItem={({ item }) => (
                <QuestItem task={item} onToggle={onToggleTask} onPress={onPressTask} onLongPressQuickSkip={onLongPressQuickSkip} />
              )}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          </View>
        )}
      </View>
    );
  }

  // 以降はドロワー表示
  if (tasks.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🎯</Text>
        <Text style={styles.emptyText}>タスクを生成中...</Text>
        <Text style={styles.emptySubtext}>少々お待ちください</Text>
      </View>
    );
  }

  const drawerTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [height * 0.6, 0],
  });

  const handleAreaTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -height * 0.6],
  });

  return (
    <>
      {/* タスクサマリーバー */}
      <Animated.View 
        style={[
          styles.summaryContainer,
          { transform: [{ translateY: handleAreaTranslateY }] }
        ]}
      >
        <TouchableOpacity style={styles.summaryTouchable} onPress={toggleDrawer}>
          <View style={styles.dragHandle} />
          
          <View style={styles.summaryContent}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryTitle}>今日のクエスト</Text>
              {dreamSelf && (
                <Text style={styles.dreamText} numberOfLines={1}>
                  目標: {dreamSelf}
                </Text>
              )}
            </View>
            
            <View style={styles.summaryRight}>
              <View style={styles.progressCircle}>
                <Text style={styles.progressText}>
                  {completedTasks.length}/{tasks.length}
                </Text>
              </View>
              <Text style={styles.expandText}>
                {isExpanded ? '↓ 閉じる' : '↑ 開く'}
              </Text>
            </View>
          </View>

          {/* プレビュー（未展開時） */}
          {!isExpanded && incompleteTasks.length > 0 && (
            <View style={styles.previewContainer}>
              <Text style={styles.previewText} numberOfLines={1}>
                次: {incompleteTasks[0].title}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* ドロワー */}
      <Animated.View 
        style={[
          styles.drawerContainer,
          { transform: [{ translateY: drawerTranslateY }] }
        ]}
      >
        <View style={styles.drawerContent}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>今日のクエスト一覧</Text>
            <TouchableOpacity onPress={toggleDrawer} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 未完了タスク */}
          {incompleteTasks.length > 0 && (
            <View style={styles.taskSection}>
              <Text style={styles.sectionTitle}>
                🎯 やること ({incompleteTasks.length}個)
              </Text>
              <FlatList
                data={incompleteTasks}
                keyExtractor={(item) => `incomplete-${item.id}`}
                renderItem={({ item }) => (
                  <QuestItem task={item} onToggle={onToggleTask} onLongPressQuickSkip={onLongPressQuickSkip} />
                )}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* 完了済みタスク */}
          {completedTasks.length > 0 && (
            <View style={styles.taskSection}>
              <Text style={styles.sectionTitle}>
                ✅ 完了済み ({completedTasks.length}個)
              </Text>
              <FlatList
                data={completedTasks}
                keyExtractor={(item) => `completed-${item.id}`}
                renderItem={({ item }) => (
                  <QuestItem task={item} onToggle={onToggleTask} onLongPressQuickSkip={onLongPressQuickSkip} />
                )}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
              />
            </View>
          )}
        </View>
      </Animated.View>

      {/* オーバーレイ */}
      {isExpanded && (
        <TouchableOpacity 
          style={styles.overlay} 
          onPress={toggleDrawer}
          activeOpacity={1}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  // Page variant styles
  pageContainer: {
    backgroundColor: 'transparent',
  },
  pageHeader: {
    marginBottom: 10,
  },
  pageEmptyContainer: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryTouchable: {
    padding: 15,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  summaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLeft: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  dreamText: {
    fontSize: 12,
    color: theme.colors.subtext,
    marginTop: 2,
  },
  summaryRight: {
    alignItems: 'center',
  },
  progressCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.surface,
  },
  expandText: {
    fontSize: 10,
    color: theme.colors.subtext,
    marginTop: 4,
  },
  previewContainer: {
    marginTop: 10,
    paddingHorizontal: 10,
  },
  previewText: {
    fontSize: 14,
    color: theme.colors.subtext,
  },
  drawerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.8,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  drawerContent: {
    flex: 1,
    padding: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  closeButtonText: {
    fontSize: 16,
    color: theme.colors.text,
  },
  taskSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 10,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyEmoji: {
    fontSize: 50,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.subtext,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.subtext,
    textAlign: 'center',
  },
});
