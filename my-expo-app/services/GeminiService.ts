import { GoogleGenerativeAI } from '@google/generative-ai';
import Constants from 'expo-constants';

export interface PersonalizedTask {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  estimatedTime: string;
  priority: number;
  isCompleted: boolean;
  createdAt: Date;
}

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      console.warn('Gemini API key not found');
    }
  }

  /**
   * チャット（ユーザー発話とAI応答）から実行可能なタスクを抽出し、
   * title/description/category/priority(low|medium|high) の配列を返します。
   * 抽出対象がなければ空配列。
   */
  async extractTasksFromText(
    userMessage: string,
    aiMessage: string,
    context: string = ''
  ): Promise<Array<{ title: string; description?: string; category?: string; priority: 'low' | 'medium' | 'high' }>> {
    // フォールバック: モデル未初期化時は安全に簡易抽出 or 空
    if (!this.genAI) {
      // ユーザー文に「タスク:」「TODO:」「やること:」行があれば簡易抽出
      const fallback = this.simpleExtractFromText(`${context}\n${userMessage}\n${aiMessage}`);
      return fallback;
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `あなたはタスク抽出エンジンです。以下の会話文脈から、今日/今後すぐに実行可能な新規タスクのみを抽出してください。該当がなければ空配列[]を出力します。

【出力要件】
- 厳密なJSONのみを出力。説明文・コードブロック・前置きは不要。
- 形式: [{"title": string, "description"?: string, "category"?: string, "priority": "low"|"medium"|"high"}]
- 「提案」や「検討」だけで具体的行動が不明なものは含めない。
- 同義重複はまとめる。

【優先度の決め方】
- すぐやる/締切が近い/重要度が高い -> high
- 通常 -> medium
- 余裕があれば/任意 -> low

【会話文脈】
Context:\n${context}
User:\n${userMessage}
AI:\n${aiMessage}`;

      const result = await model.generateContent(prompt);
      const text = (await result.response).text().trim();

      // JSON抽出（コードブロック/説明を想定して頑健に）
      const json = this.tryParseJSONArray(text);
      if (Array.isArray(json)) {
        return json
          .filter((t: any) => t && t.title)
          .map((t: any) => ({
            title: String(t.title).trim(),
            description: t.description ? String(t.description).trim() : undefined,
            category: t.category ? String(t.category).trim() : undefined,
            priority: (['low', 'medium', 'high'].includes(String(t.priority))
              ? String(t.priority)
              : 'medium') as 'low' | 'medium' | 'high',
          }));
      }
      return [];
    } catch (e) {
      console.warn('extractTasksFromText failed, fallback to simple parse:', e);
      return this.simpleExtractFromText(`${context}\n${userMessage}\n${aiMessage}`);
    }
  }

  // できるだけ厳密JSONを取り出す
  private tryParseJSONArray(text: string): any[] | null {
    const candidates: string[] = [];
    // ```json ... ```
    const fence = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (fence) candidates.push(fence[1]);
    // [...] 単純配列
    const bracket = text.match(/\[([\s\S]*)\]/);
    if (bracket) candidates.push('[' + bracket[1] + ']');
    // 原文全体を最後の候補に
    candidates.push(text);

    for (const c of candidates) {
      try {
        const parsed = JSON.parse(c);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {
        // ignore
      }
    }
    return null;
  }

  // LLMなし用の簡易抽出: 行頭の「タスク:」「TODO:」「・」「- 」などからタイトル抽出
  private simpleExtractFromText(text: string): Array<{ title: string; description?: string; category?: string; priority: 'low' | 'medium' | 'high' }> {
    const lines = text.split(/\r?\n/);
    const tasks: Array<{ title: string; description?: string; category?: string; priority: 'low' | 'medium' | 'high' }> = [];
    const regexes = [/^\s*(?:タスク|TODO|やること)\s*[:：]\s*(.+)$/i, /^\s*[・\-]\s*(.+)$/];
    for (const line of lines) {
      const raw = line.trim();
      let title: string | null = null;
      for (const r of regexes) {
        const m = raw.match(r);
        if (m && m[1]) { title = m[1].trim(); break; }
      }
      if (!title) continue;
      if (title.length < 2) continue;
      tasks.push({ title, priority: 'medium' });
      if (tasks.length >= 3) break; // 暴走防止
    }
    return tasks;
  }

  async generatePersonalizedTasks(userGoal: string, userName: string): Promise<PersonalizedTask[]> {
    if (!this.genAI) {
      console.warn('Gemini AI not initialized. Returning sample tasks.');
      return this.getSampleTasks(userGoal);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `${userName}さんが「${userGoal}」という憧れの自分になるために、具体的で実行可能なタスクを5つ作成してください。
      
重要な要求:
- タイトルは簡潔で魅力的に
- 説明は具体的な行動を含む
- 難易度と所要時間を現実的に設定
- カテゴリは適切に分類

以下のJSON形式で回答してください：
[
  {
    "title": "魅力的なタスクタイトル",
    "description": "具体的な行動と方法を含む説明",
    "category": "健康/学習/キャリア/人間関係/趣味/その他",
    "difficulty": "Easy/Medium/Hard",
    "estimatedTime": "30分/1時間/2時間/1日",
    "priority": 1
  }
]`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // JSONの抽出を試行
      let jsonMatch = text.match(/\[([\s\S]*)\]/);
      if (!jsonMatch) {
        jsonMatch = text.match(/```json\s*\[([\s\S]*)\]\s*```/);
      }
      
      if (jsonMatch) {
        const jsonString = '[' + jsonMatch[1] + ']';
        const rawTasks = JSON.parse(jsonString);
        
        return rawTasks.map((task: any, index: number) => ({
          id: `task_${Date.now()}_${index}`,
          title: task.title || `${userGoal}に関するタスク${index + 1}`,
          description: task.description || '具体的な行動を計画してください',
          category: task.category || 'その他',
          difficulty: task.difficulty || 'Medium',
          estimatedTime: task.estimatedTime || '1時間',
          priority: task.priority || index + 1,
          isCompleted: false,
          createdAt: new Date()
        }));
      } else {
        console.warn('Failed to parse Gemini response as JSON');
        return this.getSampleTasks(userGoal);
      }
    } catch (error) {
      console.error('Error generating tasks with Gemini:', error);
      return this.getSampleTasks(userGoal);
    }
  }

  private getSampleTasks(userGoal: string): PersonalizedTask[] {
    return [
      {
        id: `sample_1_${Date.now()}`,
        title: `${userGoal}への第一歩`,
        description: '目標達成のための基本的な準備を始めましょう',
        category: 'その他',
        difficulty: 'Easy',
        estimatedTime: '30分',
        priority: 1,
        isCompleted: false,
        createdAt: new Date()
      },
      {
        id: `sample_2_${Date.now()}`,
        title: '学習計画の作成',
        description: '具体的な学習スケジュールを立てて実行しましょう',
        category: '学習',
        difficulty: 'Medium',
        estimatedTime: '1時間',
        priority: 2,
        isCompleted: false,
        createdAt: new Date()
      },
      {
        id: `sample_3_${Date.now()}`,
        title: '健康習慣の構築',
        description: '目標達成に必要な体力と集中力を養いましょう',
        category: '健康',
        difficulty: 'Easy',
        estimatedTime: '30分',
        priority: 3,
        isCompleted: false,
        createdAt: new Date()
      }
    ];
  }

  async generateJournalEntry(userConversations: string[], todaysTasks: any[] = []): Promise<string> {
    if (!this.genAI) {
      return this.getSampleJournalEntry();
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const conversationText = userConversations.length > 0 
        ? userConversations.join('\n\n') 
        : '今日は特に会話はありませんでした';
      
      const tasksText = todaysTasks.length > 0 
        ? todaysTasks.map(task => `・${task.title}: ${task.completed ? '完了' : '未完了'}`).join('\n')
        : '今日のタスクはありませんでした';

      const prompt = `あなたはAIアシスタントとして、ユーザーとの今日の会話を振り返って「今日の私」という視点で日記を書いてください。

【今日の会話内容】
${conversationText}

【今日のタスク状況】
${tasksText}

以下の要件で日記を作成してください：
- ユーザーの視点で「今日の私は...」という形で書く
- 会話から読み取れる感情や気づきを含める
- 成長や学びがあった点を強調する
- 300-500文字程度
- 温かく前向きな視点で
- ユーザーの人柄や努力を認める内容に

日記の内容のみを返してください（余計な説明は不要）。`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return text.trim();
    } catch (error) {
      console.error('Error generating journal entry:', error);
      return this.getSampleJournalEntry();
    }
  }

  async analyzeEmotion(journalContent: string): Promise<string> {
    if (!this.genAI) {
      return 'peaceful';
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `以下の日記の内容から、その日の主な感情を1つの単語で表現してください。

日記内容：
${journalContent}

感情の選択肢：
happy, excited, peaceful, thoughtful, grateful, determined, confident, curious, content, hopeful

最も適切な感情を1つの英単語でのみ返してください。`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const emotion = response.text().trim().toLowerCase();
      
      const validEmotions = ['happy', 'excited', 'peaceful', 'thoughtful', 'grateful', 'determined', 'confident', 'curious', 'content', 'hopeful'];
      
      return validEmotions.includes(emotion) ? emotion : 'peaceful';
    } catch (error) {
      console.error('Error analyzing emotion:', error);
      return 'peaceful';
    }
  }

  private getSampleJournalEntry(): string {
    return `今日の私は、新しいことに挑戦する勇気を持てた一日でした。

アプリを使って目標に向かって歩みを進めている自分を感じることができました。小さな一歩かもしれませんが、憧れの自分に近づいているという実感があります。

AIと会話しながら、自分の考えを整理できたのも良かったです。時には立ち止まって振り返ることの大切さを改めて感じました。

明日も今日の気持ちを大切に、一歩ずつ前進していきたいと思います。`;
  }

  async generateChatResponse(userMessage: string, context: string = ''): Promise<string> {
    if (!this.genAI) {
      return this.getSampleChatResponse(userMessage);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `あなたは優しいライフコーチです。以下の文脈を参考に、ユーザーのメッセージに短く親身に返信してください。最大で2-3文。

【文脈】
${context}

【ユーザーのメッセージ】
${userMessage}`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (e) {
      console.error('Error generating chat response:', e);
      return this.getSampleChatResponse(userMessage);
    }
  }

  private getSampleChatResponse(userMessage: string): string {
    return `なるほど。「${userMessage}」について考えているんですね。無理せず、一歩ずつ進めていきましょう。できそうな最初の小さな一歩は何でしょう？`;
  }
}

export default new GeminiService();
