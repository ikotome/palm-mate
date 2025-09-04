import { Task, DailyProgress } from '../models/TaskModel';
import { Journal, EmotionData } from '../models/JournalModel';
import { UserProfile } from '../models/UserModel';
import { Conversation } from '../models/ConversationModel';
import { db, sqliteDb } from '../db/client';
import { tasks, userProfiles, journals, conversations } from '../db/schema';
import { jstDateString, getJstDayUtcRange } from '../utils/time';
import { and, asc, desc, eq, gte, lte, sql, inArray } from 'drizzle-orm';

class DatabaseService {
  async initializeDatabase(): Promise<void> {
    try {
  await this.createTables();
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * 全データ削除：既存テーブルをDROPして空の状態で再作成します。
   */
  async resetDatabase(): Promise<void> {
    try {
      // 参照制約などは使っていないが、安全のためトランザクションで囲む
      sqliteDb.execSync('BEGIN');
      sqliteDb.execSync('DROP TABLE IF EXISTS conversations;');
      sqliteDb.execSync('DROP TABLE IF EXISTS journals;');
      sqliteDb.execSync('DROP TABLE IF EXISTS user_profiles;');
      sqliteDb.execSync('DROP TABLE IF EXISTS tasks;');
      sqliteDb.execSync('COMMIT');
    } catch (e) {
      try { sqliteDb.execSync('ROLLBACK'); } catch {}
      console.error('Failed to drop tables:', e);
      throw e;
    }

    try {
      // ファイル縮小（任意）
      sqliteDb.execSync('VACUUM');
    } catch {}

    // 空スキーマを再作成
    await this.createTables();
  }

  private async createTables(): Promise<void> {
    // drizzle はマイグレーション実行まで DDL を作らないため、ここで最低限のテーブルを作成
    // 既存の単一接続（sqliteDb）でDDLを適用
    sqliteDb.execSync(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        completed INTEGER DEFAULT 0,
        status TEXT DEFAULT 'todo',
        created_at TEXT NOT NULL,
        completed_at TEXT,
        category TEXT,
        priority TEXT DEFAULT 'medium',
        due_date TEXT
      );
    `);
    // 既存DBに due_date がなければ追加
    try {
      sqliteDb.execSync("ALTER TABLE tasks ADD COLUMN due_date TEXT");
    } catch {}
    // 既存DBに status がなければ追加
    try {
      sqliteDb.execSync("ALTER TABLE tasks ADD COLUMN status TEXT DEFAULT 'todo'");
    } catch {}
    sqliteDb.execSync(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dream_self TEXT NOT NULL,
        dream_description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    sqliteDb.execSync(`
      CREATE TABLE IF NOT EXISTS journals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        title TEXT,
        content TEXT NOT NULL,
        emotion TEXT NOT NULL,
        ai_generated INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    sqliteDb.execSync(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT DEFAULT 'default',
        user_message TEXT NOT NULL,
        ai_response TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        emotion TEXT,
        topic TEXT
      );
    `);
  }

  // Task operations
  async getTasks(): Promise<Task[]> {
    // 日本日のUTC範囲に含まれる created_at を取得
    const { start, end } = getJstDayUtcRange();
    const rows = await db
      .select()
      .from(tasks)
      .where(and(gte(tasks.createdAt, start), lte(tasks.createdAt, end)))
      .orderBy(desc(tasks.createdAt));
    return rows.map(this.mapRowToTaskFromDrizzle);
  }

  async getTaskById(id: number): Promise<Task | null> {
    const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return rows[0] ? this.mapRowToTaskFromDrizzle(rows[0]) : null;
  }

  async getTodayTasks(): Promise<Task[]> {
    const { start, end } = getJstDayUtcRange();
    const rows = await db
      .select()
      .from(tasks)
      .where(and(gte(tasks.createdAt, start), lte(tasks.createdAt, end)))
  .orderBy(asc(tasks.completed), desc(tasks.createdAt));
    return rows.map(this.mapRowToTaskFromDrizzle);
  }

  async getTodaysTasksCount(): Promise<number> {
    const { start, end } = getJstDayUtcRange();
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(and(gte(tasks.createdAt, start), lte(tasks.createdAt, end)));
    return row?.count ?? 0;
  }

  async createTask(task: Omit<Task, 'id'>): Promise<number> {
  const inserted = await db
      .insert(tasks)
      .values({
        title: task.title,
        description: task.description ?? '',
        completed: task.completed ? 1 : 0,
        status: task.status ?? (task.completed ? 'done' : 'todo'),
        createdAt: task.createdAt,
        category: task.category ?? '',
        priority: task.priority,
  dueDate: task.dueDate ?? null as any,
      })
      .returning({ id: tasks.id });
    return inserted[0]?.id ?? 0;
  }

  async updateTask(id: number, updates: Partial<Task>): Promise<void> {
  const set: any = {};
    if (updates.completed !== undefined) {
      set.completed = updates.completed ? 1 : 0;
      set.status = updates.completed ? 'done' : (updates.status ?? 'todo');
      if (updates.completed) {
        set.completedAt = new Date().toISOString();
      } else {
        // 未完了に戻した場合は完了日時をクリア
        set.completedAt = null as any;
      }
    }
    if (updates.status !== undefined) {
      set.status = updates.status;
      // statusが直接更新された場合、completed との整合を取る
      if (updates.status === 'done') {
        set.completed = 1;
        if (!set.completedAt) set.completedAt = new Date().toISOString();
      } else if (updates.status === 'todo') {
        set.completed = 0;
        set.completedAt = null as any;
      } else if (updates.status === 'skipped') {
        set.completed = 0;
        set.completedAt = null as any;
      }
    }
    if (updates.title !== undefined) set.title = updates.title;
    if (updates.description !== undefined) set.description = updates.description ?? '';
    if (updates.priority !== undefined) set.priority = updates.priority;
  if (updates.dueDate !== undefined) set.dueDate = updates.dueDate ?? null;
    if (Object.keys(set).length === 0) return;
  await db.update(tasks).set(set).where(eq(tasks.id, id));
  }

  async addTask(task: Omit<Task, 'id'>): Promise<number> {
  return this.createTask(task);
  }

  // Journal operations
  async getJournals(): Promise<Journal[]> {
  const rows = await db.select().from(journals).orderBy(desc(journals.date));
  return rows.map(this.mapRowToJournalFromDrizzle);
  }

  async getJournalByDate(date: string): Promise<Journal | null> {
  const rows = await db
      .select()
      .from(journals)
      .where(eq(journals.date, date))
      .limit(1);
    return rows[0] ? this.mapRowToJournalFromDrizzle(rows[0]) : null;
  }

  async saveJournal(journal: Omit<Journal, 'id'>): Promise<number> {
  const [res] = await db
      .insert(journals)
      .values({
        date: journal.date,
        title: journal.title ?? '',
        content: journal.content,
        emotion: journal.emotion,
        aiGenerated: journal.aiGenerated ? 1 : 0,
        createdAt: journal.createdAt,
        updatedAt: journal.updatedAt,
      })
      .onConflictDoUpdate({
        target: journals.date,
        set: {
          title: journal.title ?? '',
          content: journal.content,
          emotion: journal.emotion,
          aiGenerated: journal.aiGenerated ? 1 : 0,
          updatedAt: journal.updatedAt,
        },
      })
      .returning({ id: journals.id });
    return res?.id ?? 0;
  }

  async getDailyProgress(date: string): Promise<DailyProgress> {
    const { start, end } = getJstDayUtcRange(date);
    const [row] = await db
      .select({
        totalTasks: sql<number>`COUNT(*)`,
        completedTasks: sql<number>`SUM(CASE WHEN ${tasks.completed} = 1 THEN 1 ELSE 0 END)`,
      })
      .from(tasks)
      .where(and(gte(tasks.createdAt, start), lte(tasks.createdAt, end)));

    const totalTasks = row?.totalTasks ?? 0;
    const completedTasks = row?.completedTasks ?? 0;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return { date, totalTasks, completedTasks, completionRate };
  }

  async getCompletedTasksByDate(date: string): Promise<Task[]> {
    const { start, end } = getJstDayUtcRange(date);
    const rows = await db
      .select()
      .from(tasks)
      .where(and(gte(tasks.completedAt, start), lte(tasks.completedAt, end), eq(tasks.completed, 1 as any)))
      .orderBy(asc(tasks.completedAt));
    return rows.map(this.mapRowToTaskFromDrizzle);
  }

  async getYesterdayCompletedCount(): Promise<number> {
    // JSTの「昨日」のUTC範囲
    const todayJst = jstDateString();
    const dt = new Date(`${todayJst}T00:00:00+09:00`);
    dt.setUTCDate(dt.getUTCDate() - 1);
    const ymd = jstDateString(new Date(dt));
    const { start, end } = getJstDayUtcRange(ymd);
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(and(gte(tasks.completedAt, start), lte(tasks.completedAt, end), eq(tasks.completed, 1 as any)));
    return row?.count ?? 0;
  }

  // 今日のタスクを keep 件だけ残して他は削除
  async pruneTodayTasks(keep: number = 5): Promise<number> {
    const list = await this.getTodayTasks(); // 未完了優先・新しい順
    if (list.length <= keep) return 0;
    const toDelete = list.slice(keep).map(t => t.id);
    if (toDelete.length === 0) return 0;
    await db.delete(tasks).where(inArray(tasks.id, toDelete));
    return toDelete.length;
  }

  async getTaskStats(): Promise<{ totalTasks: number; completedTasks: number }> {
  const [row] = await db
      .select({
        totalTasks: sql<number>`COUNT(*)`,
        completedTasks: sql<number>`SUM(CASE WHEN ${tasks.completed} = 1 THEN 1 ELSE 0 END)`,
      })
      .from(tasks);
    return {
      totalTasks: row?.totalTasks ?? 0,
      completedTasks: row?.completedTasks ?? 0,
    };
  }

  /**
   * アプリ開始日（最初にデータが作られた日）を返す。
   * user_profiles.created_at, tasks.created_at, journals.created_at, conversations.timestamp の最小を採用。
   * データがなければ今日の日付（YYYY-MM-DD）。
   */
  async getAppStartDate(): Promise<string> {
    const [t, u, j, c] = await Promise.all([
      db.select({ min: sql<string>`MIN(${tasks.createdAt})` }).from(tasks),
      db.select({ min: sql<string>`MIN(${userProfiles.createdAt})` }).from(userProfiles),
      db.select({ min: sql<string>`MIN(${journals.createdAt})` }).from(journals),
      db.select({ min: sql<string>`MIN(${conversations.timestamp})` }).from(conversations),
    ]);

    const dates = [t?.[0]?.min, u?.[0]?.min, j?.[0]?.min, c?.[0]?.min].filter(Boolean) as string[];
    if (dates.length === 0) return new Date().toISOString().split('T')[0];

    let minTs = Number.POSITIVE_INFINITY;
    for (const d of dates) {
      const ts = Date.parse(d);
      if (!Number.isNaN(ts) && ts < minTs) minTs = ts;
    }
    if (!Number.isFinite(minTs)) return new Date().toISOString().split('T')[0];
    const dt = new Date(minTs);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private mapRowToTaskFromDrizzle(row: any): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      completed: row.completed === 1,
  status: (row.status as any) ?? (row.completed === 1 ? 'done' : 'todo'),
      createdAt: row.createdAt,
      completedAt: row.completedAt ?? undefined,
      category: row.category ?? undefined,
      priority: row.priority as Task['priority'],
  dueDate: row.dueDate ?? undefined,
    };
  }

  // UserProfile operations
  async getUserProfile(): Promise<UserProfile | null> {
  const rows = await db
      .select()
      .from(userProfiles)
      .orderBy(desc(userProfiles.updatedAt))
      .limit(1);
    return rows[0] ? this.mapRowToUserProfileFromDrizzle(rows[0]) : null;
  }

  async createUserProfile(dreamSelf: string, dreamDescription?: string): Promise<number> {
    const now = new Date().toISOString();
  const inserted = await db
      .insert(userProfiles)
      .values({
        dreamSelf,
        dreamDescription: dreamDescription ?? '',
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: userProfiles.id });
    return inserted[0]?.id ?? 0;
  }

  async saveUserProfile(profile: Omit<UserProfile, 'id'>): Promise<number> {
  const inserted = await db
      .insert(userProfiles)
      .values({
        dreamSelf: profile.dreamSelf,
        dreamDescription: profile.dreamDescription ?? '',
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      })
      .returning({ id: userProfiles.id });
    return inserted[0]?.id ?? 0;
  }

  async updateUserProfile(id: number, updates: Partial<UserProfile>): Promise<void> {
  const set: any = { updatedAt: new Date().toISOString() };
  if (updates.dreamSelf !== undefined) set.dreamSelf = updates.dreamSelf;
  if (updates.dreamDescription !== undefined) set.dreamDescription = updates.dreamDescription ?? '';
  await db.update(userProfiles).set(set).where(eq(userProfiles.id, id));
  }

  private mapRowToUserProfileFromDrizzle(row: any): UserProfile {
    return {
      id: row.id,
      dreamSelf: row.dreamSelf,
      dreamDescription: row.dreamDescription ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapRowToJournalFromDrizzle(row: any): Journal {
    return {
      id: row.id,
      date: row.date,
      title: row.title ?? undefined,
      content: row.content,
      emotion: row.emotion as Journal['emotion'],
      aiGenerated: row.aiGenerated === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // Conversation operations
  async saveConversation(conversation: Omit<Conversation, 'id'>): Promise<Conversation> {
  const inserted = await db
      .insert(conversations)
      .values({
        userId: conversation.userId,
        userMessage: conversation.userMessage,
        aiResponse: conversation.aiResponse,
        timestamp: conversation.timestamp,
        emotion: conversation.emotion ?? null,
        topic: conversation.topic ?? null,
      })
      .returning({ id: conversations.id });
    const id = inserted[0]?.id ?? 0;
    return { id: id.toString(), ...conversation };
  }

  async getTodaysConversations(date?: string): Promise<Conversation[]> {
    const targetDate = date || jstDateString();
    const { start, end } = getJstDayUtcRange(targetDate);
  const rows = await db
      .select()
      .from(conversations)
      .where(and(gte(conversations.timestamp, start), lte(conversations.timestamp, end)))
      .orderBy(asc(conversations.timestamp));
    return rows.map(this.mapRowToConversationFromDrizzle);
  }

  async getRecentConversations(limit: number = 10): Promise<Conversation[]> {
  const rows = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.timestamp))
      .limit(limit);
    return rows.map(this.mapRowToConversationFromDrizzle);
  }

  private mapRowToConversationFromDrizzle(row: any): Conversation {
    return {
      id: row.id.toString(),
      userId: row.userId,
      userMessage: row.userMessage,
      aiResponse: row.aiResponse,
      timestamp: row.timestamp,
      emotion: row.emotion ?? undefined,
      topic: row.topic ?? undefined,
    };
  }

  /**
   * デバッグ用途：過去 `days` 日分のタスクと日記を適当に生成します。
   * - タスク: 0-5件/日、完了/未完了をランダム、completedAt は当日内のランダム時刻
   * - 日記: 70%の確率で1件/日（同日が既にある場合は upsert）
   * 戻り値は作成件数の集計。
   */
  async seedDummyData(days: number = 30): Promise<{ tasks: number; journals: number }> {
    const emotions = [
      'happy', 'excited', 'peaceful', 'thoughtful', 'grateful', 'determined',
      'confident', 'curious', 'content', 'hopeful', 'sad', 'angry', 'calm', 'neutral',
    ] as const;

    const taskTitles = [
      'ストレッチ', '読書', '瞑想', '散歩', '水分補給', 'ToDo整理', '日記を書く', '片付け', '英語学習', '学習メモ',
    ];

    const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
    const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    const toDateStr = (d: Date) => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    const isoAt = (baseDate: Date, h: number, m: number, s: number) => {
      const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), h, m, s, randInt(0, 999)));
      return d.toISOString();
    };

    let taskCount = 0;
    let journalCount = 0;

    for (let i = days - 1; i >= 0; i--) {
      const base = new Date();
      // UTC基準で i 日前
      base.setUTCDate(base.getUTCDate() - i);
      const dayStr = toDateStr(base);

      // タスク生成（0-5件）
      const nTasks = randInt(0, 5);
      for (let t = 0; t < nTasks; t++) {
        const createdAt = isoAt(base, randInt(7, 21), randInt(0, 59), randInt(0, 59));
        const completed = Math.random() < 0.6; // 60%で完了
        const completedAt = completed ? isoAt(base, randInt(8, 23), randInt(0, 59), randInt(0, 59)) : null;
        const priority = (['low', 'medium', 'high'] as const)[randInt(0, 2)];

        await db.insert(tasks).values({
          title: pick(taskTitles),
          description: '',
          completed: completed ? 1 : 0,
          createdAt,
          completedAt: completedAt as any,
          category: '',
          priority,
        });
        taskCount++;
      }

      // 日記生成（70%で作成）
      if (Math.random() < 0.7) {
        const createdAt = isoAt(base, randInt(19, 22), randInt(0, 59), randInt(0, 59));
        const updatedAt = createdAt;
        const emotion = pick(emotions);
        const contentSamples = [
          '今日は小さな一歩が踏み出せた。気分は上々。',
          '少し疲れたけど、前に進めている感じがする。',
          '集中できた時間があった。続けていきたい。',
          'やり残しはあるけれど、今は十分。',
          '新しい発見があった日。メモしておこう。',
        ];

        await this.saveJournal({
          date: dayStr,
          title: undefined,
          content: pick(contentSamples),
          emotion: emotion as any,
          aiGenerated: true,
          createdAt,
          updatedAt,
        });
        journalCount++;
      }
    }

    return { tasks: taskCount, journals: journalCount };
  }
}

export default new DatabaseService();
