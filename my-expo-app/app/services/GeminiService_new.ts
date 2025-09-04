import { GoogleGenerativeAI } from '@google/generative-ai';
import { Task } from '../models/TaskModel';
import { Journal } from '../models/JournalModel';

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    // 環境変数またはここにAPIキーを設定
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY';
    if (apiKey && apiKey !== 'YOUR_GEMINI_API_KEY') {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash'});
    }
  }

  async generateDailyTasks(previousTasks?: Task[], dreamSelf?: string): Promise<string[]> {
    if (!this.model) {
      return this.getFallbackTasks();
    }

    try {
      let prompt = `
        今日のおすすめタスクを4つ生成してください。
        以下の条件を満たしてください：
        - 健康的で前向きな活動
        - 30分〜1時間程度で完了できる
        - 自己成長につながる
        - 日常生活に取り入れやすい
      `;

      if (dreamSelf) {
        prompt += `
        
        【重要】ユーザーの憧れの自分：「${dreamSelf}」
        この目標に向かって成長できるようなタスクを含めてください。
        `;
      }
        
      if (previousTasks && previousTasks.length > 0) {
        prompt += `
        
        過去のタスク参考: ${previousTasks.map(t => t.title).join(', ')}
        似たようなタスクは避けて、バリエーションを持たせてください。
        `;
      }
        
      prompt += `
        
        シンプルなリスト形式で回答してください：
        - タスク1
        - タスク2
        - タスク3
        - タスク4
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const tasks = text
        .split('\n')
        .filter((line: string) => line.trim())
        .map((line: string) => line.replace(/^[-*]\s*/, '').trim())
        .filter((task: string) => task.length > 0)
        .slice(0, 4);

      return tasks.length > 0 ? tasks : this.getFallbackTasks();
    } catch (error) {
      console.error('Gemini API error:', error);
      return this.getFallbackTasks();
    }
  }

  async generatePersonalizedTasks(dreamSelf: string, dreamDescription?: string): Promise<Omit<Task, 'id'>[]> {
    if (!this.model) {
      return this.getFallbackTaskObjects();
    }

    try {
      let prompt = `
        ユーザーの目標「${dreamSelf}」に向けて、今日実践できる具体的なタスクを4つ生成してください。
        ${dreamDescription ? `詳細：${dreamDescription}` : ''}
        
        以下の条件を満たしてください：
        - 目標達成に向けた具体的で実践的なアクション
        - 30分〜1時間程度で完了できる
        - 今日から始められる
        - 段階的な成長を促す
        
        シンプルなリスト形式で回答してください：
        - タスク1
        - タスク2
        - タスク3
        - タスク4
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const taskTitles = text
        .split('\n')
        .filter((line: string) => line.trim())
        .map((line: string) => line.replace(/^[-*]\s*/, '').trim())
        .filter((task: string) => task.length > 0)
        .slice(0, 4);

      return taskTitles.map(title => ({
        title,
        description: `${dreamSelf}に向けた成長タスク`,
        completed: false,
        createdAt: new Date().toISOString(),
        category: 'personal_growth',
        priority: 'medium' as const
      }));
    } catch (error) {
      console.error('Gemini API error:', error);
      return this.getFallbackTaskObjects();
    }
  }

  async generateJournalEntry(tasks: Task[], userInput?: string): Promise<string> {
    if (!this.model) {
      return this.getFallbackJournal(tasks);
    }

    try {
      const completedTasks = tasks.filter(t => t.completed);
      const prompt = `
        今日の活動を振り返って、温かみのある日記を書いてください。
        
        完了したタスク: ${completedTasks.map(t => t.title).join(', ')}
        未完了のタスク: ${tasks.filter(t => !t.completed).map(t => t.title).join(', ')}
        ${userInput ? `ユーザーからの一言: ${userInput}` : ''}
        
        以下の点を含めてください：
        - 今日頑張ったことを褒める
        - 小さな成長や気づき
        - 明日への前向きなメッセージ
        - 200文字程度
        
        親しみやすく、優しい口調で書いてください。
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini API error:', error);
      return this.getFallbackJournal(tasks);
    }
  }

  async analyzeEmotion(journalContent: string): Promise<Journal['emotion']> {
    if (!this.model) {
      return 'neutral';
    }

    try {
      const prompt = `
        以下の日記の内容から感情を分析してください。
        
        "${journalContent}"
        
        以下の選択肢から最も適切な感情を1つ選んでください：
        - happy
        - sad
        - angry
        - excited
        - calm
        - stressed
        - grateful
        - neutral
        
        回答は選択肢の単語のみで返してください。
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const emotion = response.text().trim().toLowerCase();
      
      const validEmotions = ['happy', 'sad', 'angry', 'excited', 'calm', 'stressed', 'grateful', 'neutral'];
      return validEmotions.includes(emotion) ? emotion as Journal['emotion'] : 'neutral';
    } catch (error) {
      console.error('Gemini API error:', error);
      return 'neutral';
    }
  }

  private getFallbackTasks(): string[] {
    const fallbackTasks = [
      '深呼吸とストレッチを10分間する',
      '今日の感謝できることを3つ書く',
      '読書や学習を30分する',
      '整理整頓や片付けをする'
    ];
    
    return this.shuffleArray(fallbackTasks).slice(0, 4);
  }

  private getFallbackTaskObjects(): Omit<Task, 'id'>[] {
    const fallbackTasks = [
      '深呼吸とストレッチを10分間する',
      '今日の感謝できることを3つ書く',
      '読書や学習を30分する',
      '整理整頓や片付けをする'
    ];
    
    return this.shuffleArray(fallbackTasks).slice(0, 4).map(title => ({
      title,
      description: '今日の成長につながるタスク',
      completed: false,
      createdAt: new Date().toISOString(),
      category: 'daily',
      priority: 'medium' as const
    }));
  }

  private getFallbackJournal(tasks: Task[]): string {
    const completedCount = tasks.filter(t => t.completed).length;
    
    if (completedCount === 0) {
      return '今日はゆっくり過ごしたのですね。時には休息も大切です。明日は新しい気持ちで頑張りましょう！';
    } else if (completedCount === tasks.length) {
      return `今日は全てのタスクを完了できました！本当に素晴らしいです。あなたの努力が実を結んでいますね。明日も楽しく成長していきましょう。`;
    } else {
      return `今日は${completedCount}個のタスクを完了しました。一歩一歩着実に前進していますね。明日もあなたのペースで頑張りましょう！`;
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

export default new GeminiService();
