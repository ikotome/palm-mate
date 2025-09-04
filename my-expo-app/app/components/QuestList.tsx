import React, { useState } from 'react';
import { FlatList, View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Task } from '../models/TaskModel';
import { QuestItem } from './QuestItem';

interface QuestListProps {
  tasks: Task[];
  onToggleTask: (taskId: number) => void;
  dreamSelf?: string;
}

const { height } = Dimensions.get('window');

export const QuestList: React.FC<QuestListProps> = ({ tasks, onToggleTask, dreamSelf }) => {
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
                  <QuestItem task={item} onToggle={onToggleTask} />
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
                  <QuestItem task={item} onToggle={onToggleTask} />
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
  summaryContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  summaryTouchable: {
    padding: 15,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
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
    color: '#333',
  },
  dreamText: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
  },
  summaryRight: {
    alignItems: 'center',
  },
  progressCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  expandText: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  previewContainer: {
    marginTop: 10,
    paddingHorizontal: 10,
  },
  previewText: {
    fontSize: 14,
    color: '#666',
  },
  drawerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.8,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    borderBottomColor: '#f0f0f0',
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
  },
  taskSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
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
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  emptyEmoji: {
    fontSize: 50,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
