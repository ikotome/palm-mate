import { Task, DailyProgress } from '../models/TaskModel';
import { Journal, EmotionData } from '../models/JournalModel';
import { UserProfile } from '../models/UserModel';
import { Conversation } from '../models/ConversationModel';
import { db, sqliteDb } from '../db/client';
import { tasks, userProfiles, journals, conversations, getDayRangeISO } from '../db/schema';
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
        created_at TEXT NOT NULL,
        completed_at TEXT,
        category TEXT,
        priority TEXT DEFAULT 'medium'
      );
    `);
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
  const rows = await db
    .select()
    .from(tasks)
    .where(sql`date(${tasks.createdAt}, 'localtime') = date('now','localtime')`)
    .orderBy(desc(tasks.createdAt));
    return rows.map(this.mapRowToTaskFromDrizzle);
  }

  async getTodayTasks(): Promise<Task[]> {
  const rows = await db
    .select()
    .from(tasks)
    .where(sql`date(${tasks.createdAt}, 'localtime') = date('now','localtime')`)
    .orderBy(asc(tasks.completed), desc(tasks.createdAt));
    return rows.map(this.mapRowToTaskFromDrizzle);
  }

  async getTodaysTasksCount(): Promise<number> {
  const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(sql`date(${tasks.createdAt}, 'localtime') = date('now','localtime')`);
    return row?.count ?? 0;
  }

  async createTask(task: Omit<Task, 'id'>): Promise<number> {
  const inserted = await db
      .insert(tasks)
      .values({
        title: task.title,
        description: task.description ?? '',
        completed: task.completed ? 1 : 0,
        createdAt: task.createdAt,
        category: task.category ?? '',
        priority: task.priority,
      })
      .returning({ id: tasks.id });
    return inserted[0]?.id ?? 0;
  }

  async updateTask(id: number, updates: Partial<Task>): Promise<void> {
  const set: any = {};
    if (updates.completed !== undefined) {
      set.completed = updates.completed ? 1 : 0;
      if (updates.completed) {
        set.completedAt = new Date().toISOString();
      } else {
        // 未完了に戻した場合は完了日時をクリア
        set.completedAt = null as any;
      }
    }
    if (updates.title !== undefined) set.title = updates.title;
    if (updates.description !== undefined) set.description = updates.description ?? '';
    if (updates.priority !== undefined) set.priority = updates.priority;
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
  const [row] = await db
      .select({
        totalTasks: sql<number>`COUNT(*)`,
        completedTasks: sql<number>`SUM(CASE WHEN ${tasks.completed} = 1 THEN 1 ELSE 0 END)`,
      })
      .from(tasks)
      .where(sql`date(${tasks.createdAt}) = ${date}`);

    const totalTasks = row?.totalTasks ?? 0;
    const completedTasks = row?.completedTasks ?? 0;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    return {
      date,
      totalTasks,
      completedTasks,
      completionRate
    };
  }

  async getCompletedTasksByDate(date: string): Promise<Task[]> {
  const rows = await db
      .select()
      .from(tasks)
  .where(sql`date(${tasks.completedAt}) = ${date} AND ${tasks.completed} = 1`)
      .orderBy(asc(tasks.completedAt));
    return rows.map(this.mapRowToTaskFromDrizzle);
  }

  async getYesterdayCompletedCount(): Promise<number> {
  const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
  .where(sql`date(${tasks.completedAt}) = date('now','-1 day') AND ${tasks.completed} = 1`);
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
      createdAt: row.createdAt,
      completedAt: row.completedAt ?? undefined,
      category: row.category ?? undefined,
      priority: row.priority as Task['priority'],
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
  const targetDate = date || new Date().toISOString().split('T')[0];
  const { start, end } = getDayRangeISO(targetDate);
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
}

export default new DatabaseService();
