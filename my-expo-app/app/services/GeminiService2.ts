import { GoogleGenerativeAI } from '@google/generative-ai';
import { Task } from '../models/TaskModel';
import { Journal } from '../models/JournalModel';

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY';
    if (apiKey && apiKey !== 'YOUR_GEMINI_API_KEY') {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash'});
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
        
        タイトルのみでシンプルなリスト形式で回答してください：
        - タスク1のタイトル
        - タスク2のタイトル
        - タスク3のタイトル
        - タスク4のタイトル
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

  private getFallbackTaskObjects(): Omit<Task, 'id'>[] {
    const fallbackTasks = [
      '深呼吸とストレッチを10分間する',
      '今日の感謝できることを3つ書く',
      '読書や学習を30分する',
      '整理整頓や片付けをする'
    ];
    
    return fallbackTasks.slice(0, 4).map(title => ({
      title,
      description: '今日の成長につながるタスク',
      completed: false,
      createdAt: new Date().toISOString(),
      category: 'daily',
      priority: 'medium' as const
    }));
  }
}

export default new GeminiService();
