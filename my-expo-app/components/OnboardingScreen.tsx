import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TextInput, 
  TouchableOpacity, 
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';

interface OnboardingScreenProps {
  onComplete: (data: { dreamSelf: string; dreamDescription?: string }) => void;
}

const { width, height } = Dimensions.get('window');

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [dreamSelf, setDreamSelf] = useState('');
  const [dreamDescription, setDreamDescription] = useState('');
  const [currentStep, setCurrentStep] = useState(0);

  const examples = [
    '健康的で活力に満ちた人',
    'クリエイティブで表現力豊かな人',
    '知識豊富で学び続ける人',
    '人とのつながりを大切にする人',
    'チャレンジ精神旺盛な人',
    '心穏やかで落ち着いた人'
  ];

  const handleNext = () => {
    if (currentStep === 0 && dreamSelf.trim()) {
      setCurrentStep(1);
    } else if (currentStep === 1) {
      onComplete({
        dreamSelf: dreamSelf.trim(),
        dreamDescription: dreamDescription.trim() || undefined
      });
    }
  };

  const handleBack = () => {
    if (currentStep === 1) {
      setCurrentStep(0);
    }
  };

  const selectExample = (example: string) => {
    setDreamSelf(example);
  };

  const renderStep0 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={styles.welcomeContainer}>
        <Text style={styles.welcomeEmoji}>🌱</Text>
        <Text style={styles.welcomeTitle}>PalmMateへようこそ！</Text>
        <Text style={styles.welcomeSubtitle}>
          あなたの成長をサポートする
          {'\n'}
          パーソナルAIパートナーです
        </Text>
      </View>

      <View style={styles.questionContainer}>
        <Text style={styles.questionTitle}>どんな自分になりたいですか？</Text>
        <Text style={styles.questionSubtitle}>
          憧れの自分を教えてください。AIがあなたに合ったタスクを毎日提案します。
        </Text>

        <TextInput
          style={styles.dreamInput}
          value={dreamSelf}
          onChangeText={setDreamSelf}
          placeholder="例：健康的で活力に満ちた人"
          multiline
          maxLength={100}
          textAlignVertical="top"
        />

        <Text style={styles.examplesTitle}>💡 こんな例があります：</Text>
        <View style={styles.examplesContainer}>
          {examples.map((example, index) => (
            <TouchableOpacity
              key={index}
              style={styles.exampleChip}
              onPress={() => selectExample(example)}
            >
              <Text style={styles.exampleText}>{example}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderStep1 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={styles.confirmContainer}>
        <Text style={styles.confirmEmoji}>✨</Text>
        <Text style={styles.confirmTitle}>素晴らしい目標ですね！</Text>
        
        <View style={styles.dreamDisplay}>
          <Text style={styles.dreamLabel}>あなたの憧れの自分：</Text>
          <Text style={styles.dreamText}>「{dreamSelf}」</Text>
        </View>

        <Text style={styles.descriptionLabel}>
          もう少し詳しく教えてください（任意）
        </Text>
        <Text style={styles.descriptionSubtitle}>
          具体的な理由や、どんな風になりたいかなど...
        </Text>

        <TextInput
          style={styles.descriptionInput}
          value={dreamDescription}
          onChangeText={setDreamDescription}
          placeholder="例：毎日元気に過ごして、周りの人にも良い影響を与えたい。運動習慣をつけて、健康的な食事を心がけたい。"
          multiline
          maxLength={300}
          textAlignVertical="top"
        />

        <View style={styles.benefitsContainer}>
          <Text style={styles.benefitsTitle}>🎯 AIがあなたのために：</Text>
          <Text style={styles.benefitItem}>• 目標に合わせたタスクを毎日提案</Text>
          <Text style={styles.benefitItem}>• 進捗に応じて励ましメッセージ</Text>
          <Text style={styles.benefitItem}>• 成長を記録して振り返り</Text>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* プログレスバー */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${((currentStep + 1) / 2) * 100}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {currentStep + 1} / 2
          </Text>
        </View>

        {/* ステップコンテンツ */}
        <View style={styles.contentContainer}>
          {currentStep === 0 ? renderStep0() : renderStep1()}
        </View>

        {/* ボタンエリア */}
        <View style={styles.buttonContainer}>
          {currentStep === 1 && (
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>戻る</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[
              styles.nextButton,
              (!dreamSelf.trim() && currentStep === 0) && styles.nextButtonDisabled
            ]}
            onPress={handleNext}
            disabled={!dreamSelf.trim() && currentStep === 0}
          >
            <Text style={styles.nextButtonText}>
              {currentStep === 0 ? '次へ' : '開始する！'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fffe',
  },
  keyboardAvoid: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  contentContainer: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  welcomeEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  questionContainer: {
    paddingBottom: 20,
  },
  questionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  questionSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  dreamInput: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    fontSize: 16,
    minHeight: 80,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: 30,
  },
  examplesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  examplesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exampleChip: {
    backgroundColor: '#e8f5e8',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 14,
    color: '#2E7D32',
  },
  confirmContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  confirmEmoji: {
    fontSize: 60,
    marginBottom: 20,
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 30,
  },
  dreamDisplay: {
    backgroundColor: '#e8f5e8',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
    width: '100%',
  },
  dreamLabel: {
    fontSize: 14,
    color: '#2E7D32',
    marginBottom: 8,
  },
  dreamText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1B5E20',
  },
  descriptionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  descriptionSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  descriptionInput: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    fontSize: 16,
    minHeight: 120,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: 30,
    width: '100%',
  },
  benefitsContainer: {
    backgroundColor: '#fff3e0',
    borderRadius: 15,
    padding: 20,
    width: '100%',
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 10,
  },
  benefitItem: {
    fontSize: 14,
    color: '#BF360C',
    marginBottom: 5,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 15,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  nextButton: {
    flex: 2,
    backgroundColor: '#4CAF50',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#ccc',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
