import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';

interface AvatarDisplayProps {
  completionRate: number;
  emotion?: 'happy' | 'sad' | 'neutral' | 'excited' | 'proud';
}

const { width, height } = Dimensions.get('window');

export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({ 
  completionRate, 
  emotion = 'neutral' 
}) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // アバターのバウンスアニメーション
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -10,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    // タスク完了時のスケールアニメーション
    if (completionRate > 0) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }

    bounce.start();
    return () => bounce.stop();
  }, [completionRate]);

  const getAvatarEmoji = () => {
    if (completionRate >= 0.8) return '🌟';
    if (completionRate >= 0.6) return '😊';
    if (completionRate >= 0.4) return '🙂';
    if (completionRate >= 0.2) return '😐';
    return '�';
  };

  const getBackgroundGradient = () => {
    if (completionRate >= 0.8) return ['#4CAF50', '#8BC34A'];
    if (completionRate >= 0.6) return ['#8BC34A', '#CDDC39'];
    if (completionRate >= 0.4) return ['#FFC107', '#FFEB3B'];
    if (completionRate >= 0.2) return ['#FF9800', '#FFC107'];
    return ['#E3F2FD', '#BBDEFB'];
  };

  const getGrowthMessage = () => {
    if (completionRate >= 0.8) return 'キラキラ✨最高です！';
    if (completionRate >= 0.6) return 'いい調子ですね！👍';
    if (completionRate >= 0.4) return '順調に成長中🌱';
    if (completionRate >= 0.2) return 'がんばって！💪';
    return 'おはよう〜😴';
  };

  const getEnvironmentEmojis = () => {
    if (completionRate >= 0.8) return ['✨', '🌟', '�', '⭐'];
    if (completionRate >= 0.6) return ['🌸', '🌺', '🌻', '🌷'];
    if (completionRate >= 0.4) return ['🌱', '🍀', '🌿', '🌾'];
    if (completionRate >= 0.2) return ['🌤️', '⛅', '🌦️', '🌈'];
    return ['💤', '😴', '🛌', '�'];
  };

  return (
    <View style={styles.container}>
      {/* 背景装飾 */}
      <View style={[styles.background, { backgroundColor: getBackgroundGradient()[0] }]}>
        {getEnvironmentEmojis().map((emoji, index) => (
          <Text 
            key={index} 
            style={[
              styles.backgroundEmoji, 
              { 
                left: (index * width / 4) + 20,
                top: (index % 2) * 50 + 30,
              }
            ]}
          >
            {emoji}
          </Text>
        ))}
      </View>

      {/* メインアバター */}
      <Animated.View 
        style={[
          styles.avatarContainer,
          {
            transform: [
              { translateY: bounceAnim },
              { scale: scaleAnim }
            ]
          }
        ]}
      >
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarEmoji}>{getAvatarEmoji()}</Text>
        </View>
        
        {/* 吹き出し */}
        <View style={styles.speechBubble}>
          <Text style={styles.speechText}>{getGrowthMessage()}</Text>
          <View style={styles.speechTail} />
        </View>
      </Animated.View>

      {/* ステータス表示 */}
      <View style={styles.statusContainer}>
        <View style={styles.progressContainer}>
          <Text style={styles.statusLabel}>成長度</Text>
          <View style={styles.progressTrack}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${completionRate * 100}%`,
                  backgroundColor: getBackgroundGradient()[1]
                }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>{Math.round(completionRate * 100)}%</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: height * 0.6, // 画面の上部60%を使用
    position: 'relative',
    overflow: 'hidden',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backgroundEmoji: {
    position: 'absolute',
    fontSize: 20,
    opacity: 0.3,
  },
  avatarContainer: {
    alignItems: 'center',
    marginTop: height * 0.15,
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  avatarEmoji: {
    fontSize: 60,
  },
  speechBubble: {
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginTop: 15,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  speechText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  speechTail: {
    position: 'absolute',
    top: -8,
    left: '50%',
    marginLeft: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'white',
  },
  statusContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  progressContainer: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 15,
    padding: 15,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressTrack: {
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 5,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
