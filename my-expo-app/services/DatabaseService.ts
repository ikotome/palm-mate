import * as SQLite from 'expo-sqlite';
import { Task, DailyProgress } from '../models/TaskModel';
import { Journal, EmotionData } from '../models/JournalModel';
import { UserProfile } from '../models/UserModel';
import { Conversation } from '../models/ConversationModel';
import { db } from '../db/client';
import { tasks, userProfiles, journals, conversations, getDayRangeISO } from '../db/schema';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initializeDatabase(): Promise<void> {
    try {
      // 互換: 既存の async API を保持
      this.db = await SQLite.openDatabaseAsync('palmmate.db');
      await this.createTables();
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    // drizzle はマイグレーション実行まで DDL を作らないため、ここで最低限のテーブルを作成
  // expo-sqlite 同期APIでDDLを適用
  const syncDb = (SQLite as any).openDatabaseSync('palmmate.db');
  syncDb.execSync(`
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
    syncDb.execSync(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dream_self TEXT NOT NULL,
        dream_description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    syncDb.execSync(`
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
    syncDb.execSync(`
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
      .where(sql`date(${tasks.createdAt}) = date('now','localtime')`)
      .orderBy(desc(tasks.createdAt));
    return rows.map(this.mapRowToTaskFromDrizzle);
  }

  async getTodayTasks(): Promise<Task[]> {
    const rows = await db
      .select()
      .from(tasks)
      .where(sql`date(${tasks.createdAt}) = date('now','localtime')`)
      .orderBy(asc(tasks.completed), desc(tasks.createdAt));
    return rows.map(this.mapRowToTaskFromDrizzle);
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
      }
    }
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
