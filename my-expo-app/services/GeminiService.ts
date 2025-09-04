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
  private rateLimitUntil = 0; // epoch ms until which calls should be skipped
  private lastRateLimitLogAt = 0;

  constructor() {
    const apiKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      console.warn('Gemini API key not found');
    }
  }

  private isRateLimited(): boolean {
    return Date.now() < this.rateLimitUntil;
  }

  private enableRateLimitCooldown(retrySeconds?: number) {
    const seconds = typeof retrySeconds === 'number' && retrySeconds > 0 ? retrySeconds : 60;
    this.rateLimitUntil = Date.now() + seconds * 1000;
    if (Date.now() - this.lastRateLimitLogAt > 10_000) {
      this.lastRateLimitLogAt = Date.now();
      console.warn(`Gemini rate-limited. Falling back locally for ~${seconds}s.`);
    }
  }

  private parseRetrySecondsFromError(err: any): number | undefined {
    try {
      const raw = typeof err?.message === 'string' ? err.message : String(err);
      const m = raw.match(/retryDelay\":"(\d+)s/);
      if (m && m[1]) return parseInt(m[1], 10);
    } catch {}
    return undefined;
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
  if (!this.genAI || this.isRateLimited()) {
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
  // JSONでなくても、モデルが箇条書きを返す場合があるため簡易抽出を併用
  const fallbackBullets = this.simpleExtractFromText(text);
  return fallbackBullets;
    } catch (e) {
      const msg = typeof (e as any)?.message === 'string' ? (e as any).message : String(e);
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        const retrySec = this.parseRetrySecondsFromError(e);
        this.enableRateLimitCooldown(retrySec);
      } else {
        console.warn('extractTasksFromText failed. Using local fallback.');
      }
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

  // LLMなし用の簡易抽出: 日本語の列挙や区切りにも対応（最大5件）
  private simpleExtractFromText(text: string): Array<{ title: string; description?: string; category?: string; priority: 'low' | 'medium' | 'high' }> {
    const tasks: Array<{ title: string; description?: string; category?: string; priority: 'low' | 'medium' | 'high' }> = [];

    const push = (t: string) => {
      const title = t.replace(/^\d+[\).\-\s]*/, '').trim();
      if (title && title.length >= 2) {
        tasks.push({ title, priority: 'medium' });
      }
    };

    const lines = text.split(/\r?\n/);
    const bulletRegexes = [
      /^\s*(?:タスク|TODO|ToDo|やること|todo|task)\s*[:：]\s*(.+)$/i,
      /^\s*[・\-\u30fb]\s*(.+)$/, // ・ or - or ・(katakana middle dot)
      /^\s*\d+[\).\-]\s*(.+)$/ // 1) 1. 1-
    ];
    for (const line of lines) {
      const raw = line.trim();
      for (const r of bulletRegexes) {
        const m = raw.match(r);
        if (m && m[1]) {
          push(m[1]);
          if (tasks.length >= 5) return tasks;
          break;
        }
      }
    }

    if (tasks.length === 0) {
      // 文中にキーワードがある場合、句読点/セミコロン/スラッシュで分割して拾う
      const hasKeyword = /(タスク|TODO|ToDo|やること|todo|task|やりたい|やる)/i.test(text);
      if (hasKeyword) {
        const body = text.replace(/.*?(タスク|TODO|ToDo|やること|todo|task)/i, '');
        const chunks = body.split(/[、,;\/\n]|\s-\s|・/).map(s => s.trim()).filter(Boolean);
        for (const c of chunks) {
          push(c);
          if (tasks.length >= 5) break;
        }
      }
    }

    return tasks.slice(0, 5);
  }

  async generatePersonalizedTasks(userGoal: string, userName: string): Promise<PersonalizedTask[]> {
    if (!this.genAI || this.isRateLimited()) {
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
    } catch (error: any) {
      const msg = typeof error?.message === 'string' ? error.message : String(error);
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        const retrySec = this.parseRetrySecondsFromError(error);
        this.enableRateLimitCooldown(retrySec);
      } else {
        console.warn('Gemini task generation failed. Using local fallback.');
      }
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
      },
      {
        id: `sample_4_${Date.now()}`,
        title: '進捗の見える化',
        description: '今日の達成と学びを3行でメモしましょう',
        category: 'その他',
        difficulty: 'Easy',
        estimatedTime: '10分',
        priority: 4,
        isCompleted: false,
        createdAt: new Date()
      },
      {
        id: `sample_5_${Date.now()}`,
        title: '情報インプット',
        description: '関連トピックの記事を1本読んで要点をメモ',
        category: '学習',
        difficulty: 'Easy',
        estimatedTime: '20分',
        priority: 5,
        isCompleted: false,
        createdAt: new Date()
      }
    ];
  }

  // より具体的・個別最適なタスク生成（重複回避・時間/手順入り）
  async generateConcretePersonalizedTasks(input: {
    userGoal: string;
    dreamDescription?: string;
    recentConversations?: string[];
    recentCompletedTitles?: string[];
    existingTodayTitles?: string[];
    targetCount?: number; // 既定: 5
  }): Promise<Array<{ title: string; description?: string; category?: string; priority: 'low' | 'medium' | 'high' }>> {
    const targetCount = input.targetCount ?? 5;

    // モデルがない/クォータ超過時のフォールバック
  if (!this.genAI || this.isRateLimited()) {
      return this.buildConcreteFallback(input.userGoal, input.dreamDescription, input.recentCompletedTitles, input.existingTodayTitles, targetCount);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const conv = (input.recentConversations || []).slice(-10).join('\n');
      const existing = (input.existingTodayTitles || []).join(', ');
      const completed = (input.recentCompletedTitles || []).join(', ');

      const prompt = `あなたはライフコーチ兼タスク設計の専門家です。ユーザーの目標に合わせ、\n「今日すぐに実行できる、具体的で小さな行動」タスクを${targetCount}件、JSONのみで提案してください。

【ユーザーの目標】\n${input.userGoal}\n${input.dreamDescription ? `【補足】\n${input.dreamDescription}` : ''}
【最近の会話要約】\n${conv || '（会話データなし）'}
【今日すでにあるタスク】\n${existing || '（なし）'}
【直近の達成】\n${completed || '（なし）'}

必須要件：
- 重複や類似を避ける（上記の既存/達成と被らない）
- 1タスク=1アクション。30-40分以内で終わる規模。自宅/手元で実行可能。
- 説明は「手順/所要時間/目安の具体」を含める（例: 15分で記事1本、タイマー設定etc）。
- 出力は厳密JSON配列。形式のみ：
[
  {"title": string, "description": string, "category": "健康"|"学習"|"キャリア"|"人間関係"|"趣味"|"その他", "priority": "low"|"medium"|"high"}
]
- 説明文や前置きは禁止。JSON以外を出力しない。`;

      const result = await model.generateContent(prompt);
      const text = (await result.response).text().trim();
      const arr = this.tryParseJSONArray(text) || [];
      const out = arr
        .filter((t: any) => t && t.title)
        .map((t: any) => {
          const pr = typeof t.priority === 'string' ? t.priority.toLowerCase() : t.priority;
          let priority: 'low' | 'medium' | 'high' = 'medium';
          if (pr === 'high' || pr === 1 || pr === 2) priority = 'high';
          else if (pr === 'low' || pr === 5 || pr === 4) priority = 'low';
          else priority = 'medium';
          return {
            title: String(t.title).trim(),
            description: t.description ? String(t.description).trim() : undefined,
            category: t.category ? String(t.category).trim() : undefined,
            priority,
          };
        });
      if (out.length >= 1) return out.slice(0, targetCount);
      // パースできないときはフォールバック
      return this.buildConcreteFallback(input.userGoal, input.dreamDescription, input.recentCompletedTitles, input.existingTodayTitles, targetCount);
    } catch (error: any) {
      const msg = typeof error?.message === 'string' ? error.message : String(error);
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        const retrySec = this.parseRetrySecondsFromError(error);
        this.enableRateLimitCooldown(retrySec);
      } else {
        console.warn('Concrete task generation failed. Using local fallback.');
      }
      return this.buildConcreteFallback(input.userGoal, input.dreamDescription, input.recentCompletedTitles, input.existingTodayTitles, targetCount);
    }
  }

  private buildConcreteFallback(
    goal: string,
    desc: string | undefined,
    recentCompleted: string[] | undefined,
    existingToday: string[] | undefined,
    count: number
  ): Array<{ title: string; description?: string; category?: string; priority: 'low' | 'medium' | 'high' }> {
    const taken = new Set([...(recentCompleted || []), ...(existingToday || [])]);
    const ideasPool: Array<{ title: string; description: string; category: string; priority: 'low' | 'medium' | 'high' }> = [];
    const base = (goal + ' ' + (desc || '')).toLowerCase();
    const pushIdea = (t: string, d: string, c: string, p: 'low' | 'medium' | 'high') => {
      if (![...taken].some(x => x && x.includes(t))) ideasPool.push({ title: t, description: d, category: c, priority: p });
    };
    // 簡易ヒューリスティック
    if (/学|study|learn/.test(base)) {
      pushIdea('関連トピック記事を1本読む', '15分タイマーをセット→記事1本を要約(3行)してメモに保存', '学習', 'medium');
      pushIdea('用語チェックリストを作る', '重要用語を5個だけピック→各1行説明を追加(20分)', '学習', 'low');
    }
    if (/運動|健康|fit|筋|walk|run/.test(base)) {
      pushIdea('軽い運動(15分)', '自重スクワット10回×3セット or 15分散歩。終わったら水分補給', '健康', 'medium');
      pushIdea('ストレッチ3種', '首・肩・背中のストレッチ各1分×2周(約6分)', '健康', 'low');
    }
    if (/キャリア|portfol|仕事|career/.test(base)) {
      pushIdea('実績メモを1件追加', '最近の小さな成果を3行で記録(10分)。ファイルに追記', 'キャリア', 'medium');
      pushIdea('求人/案件を1件だけ調査', '気になるキーワードで1件だけ確認し要点をメモ(15分)', 'キャリア', 'low');
    }
    // 汎用
    pushIdea('明日の最重要1つを決める', '朝一でやる1つを決め、理由と最初の一歩を書き出す(10分)', 'その他', 'high');
    pushIdea('環境整備(10分)', '作業スペースの不要物を5つ片付ける。終わったらBefore/Afterを簡単に記録', 'その他', 'low');

    // 足りない分は補完
    while (ideasPool.length < count) {
      pushIdea(`関連動画を1本視聴`, '1.25xで15分視聴→学びを3行メモ(15-20分)', '学習', 'low');
      if (ideasPool.length > 20) break;
    }
    return ideasPool.slice(0, count);
  }

  async generateJournalEntry(userConversations: string[], todaysTasks: any[] = []): Promise<string> {
    // トーン自動選択をデフォルトで適用
    const tone = await this.determineJournalTone(userConversations, todaysTasks);

  if (!this.genAI || this.isRateLimited()) {
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

      const toneGuide = this.getToneInstruction(tone);

      const prompt = `あなたはAIアシスタントとして、ユーザーとの今日の会話を振り返って「今日の私」という視点で日記を書いてください。ユーザーに最適なトーンで、読みやすく記憶に残る要約を作成します。

【今日の会話内容】
${conversationText}

【今日のタスク状況】
${tasksText}

【文体ガイド（厳守）】
${toneGuide}

【出力要件】
- ユーザーの視点で「今日の私は...」という形で書く
- 会話から読み取れる感情や気づきを含める
- 成長や学びがあった点を1つ以上含める
- 220-350文字程度（長すぎない）
- 箇条書きは避け、流れる短文を中心に
- 日記本文のみを出力（前置き・後置き・絵文字の乱用は避ける）`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return text.trim();
    } catch (error: any) {
      const msg = typeof error?.message === 'string' ? error.message : String(error);
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        const retrySec = this.parseRetrySecondsFromError(error);
        this.enableRateLimitCooldown(retrySec);
      } else {
        console.warn('Error generating journal entry. Using fallback.');
      }
      return this.getSampleJournalEntry();
    }
  }

  async analyzeEmotion(journalContent: string): Promise<string> {
  if (!this.genAI || this.isRateLimited()) {
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
    } catch (error: any) {
      const msg = typeof error?.message === 'string' ? error.message : String(error);
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        const retrySec = this.parseRetrySecondsFromError(error);
        this.enableRateLimitCooldown(retrySec);
      } else {
        console.warn('Error analyzing emotion. Using fallback.');
      }
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
  if (!this.genAI || this.isRateLimited()) {
      return this.getSampleChatResponse(userMessage);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `あなたは落ち着いた日本語のライフコーチです。以下の文脈を踏まえ、具体的で端的に返答してください。

出力ルール:
- 最大2文、必要なら箇条書きは1行のみ
- 絵文字や顔文字は使わない
- 過度に馴れ馴れしい表現は避ける
- 可能なら次の一歩を1つ提案

【文脈】
${context || '（特になし）'}

【ユーザーのメッセージ】
${userMessage}`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
  let out = response.text().trim();
  // 予防的に長すぎる出力を丸める
  if (out.length > 280) out = out.slice(0, 280);
  return out;
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : String(e);
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        const retrySec = this.parseRetrySecondsFromError(e);
        this.enableRateLimitCooldown(retrySec);
      } else {
        console.warn('Error generating chat response. Using fallback.');
      }
      return this.getSampleChatResponse(userMessage);
    }
  }

  private getSampleChatResponse(userMessage: string): string {
    return `なるほど。「${userMessage}」について考えているんですね。無理せず、一歩ずつ進めていきましょう。できそうな最初の小さな一歩は何でしょう？`;
  }

  // ===== Tone selection helpers (private) =====
  private async determineJournalTone(
    userConversations: string[] = [],
    todaysTasks: any[] = []
  ): Promise<'encouraging' | 'factual' | 'gentle' | 'celebratory' | 'reflective'> {
    const total = todaysTasks.length;
    const completed = todaysTasks.filter((t: any) => !!t.completed).length;
    const rate = total > 0 ? completed / total : 0;
    const convo = userConversations.join('\n').toLowerCase();
    const hasStress = /疲|しんど|つら|辛|うまくいか|迷|不安|ミス|失敗/.test(convo);

    if (!this.genAI) {
      if (hasStress) return 'gentle';
      if (rate >= 0.7) return 'celebratory';
      if (/箇条書き|まとめ|事実/.test(convo)) return 'factual';
      return 'reflective';
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `次の会話サマリから、日記の文体トーンを1つだけ選んで出力してください。候補: encouraging, factual, gentle, celebratory, reflective。

【会話サマリ】
${userConversations.slice(-10).join('\n\n') || '（会話なし）'}

【タスク完了率】${(rate * 100).toFixed(0)}%

出力ルール:
- 上記の候補のいずれか1語のみ
- 理由や説明は書かない`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const tone = response.text().trim().toLowerCase() as any;
      const valid = ['encouraging', 'factual', 'gentle', 'celebratory', 'reflective'];
      if (valid.includes(tone)) return tone;
      if (hasStress) return 'gentle';
      if (rate >= 0.7) return 'celebratory';
      return 'reflective';
    } catch {
      if (hasStress) return 'gentle';
      if (rate >= 0.7) return 'celebratory';
      return 'reflective';
    }
  }

  private getToneInstruction(tone: 'encouraging' | 'factual' | 'gentle' | 'celebratory' | 'reflective'): string {
    switch (tone) {
      case 'encouraging':
        return `- 元気づける口調（押しつけず、伴走する語り）\n- 前進や努力の事実を拾い、次につながる一言で締める`;
      case 'factual':
        return `- 事実を簡潔に整理（主観的評価は控えめ）\n- 今日の出来事→所感→次の一歩の順で短くまとめる`;
      case 'gentle':
        return `- やさしく安心感のある語り\n- 自分を責めない視点と小さな良かった点を拾う`;
      case 'celebratory':
        return `- 前向きかつ控えめな称賛（誇張しすぎない）\n- 何が良かったか具体を1-2個挙げ、余韻を残す`;
      case 'reflective':
      default:
        return `- 振り返り重視の落ち着いたトーン\n- 気づきと次の仮説/試し方を一言で残す`;
    }
  }
}

export default new GeminiService();
