import * as SQLite from 'expo-sqlite';
import { Task, DailyProgress } from '../models/TaskModel';
import { Journal, EmotionData } from '../models/JournalModel';
import { UserProfile } from '../models/UserModel';
import { Conversation } from '../models/ConversationModel';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initializeDatabase(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync('palmmate.db');
      await this.createTables();
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
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

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dream_self TEXT NOT NULL,
        dream_description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await this.db.execAsync(`
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
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getAllAsync(`
      SELECT * FROM tasks 
      WHERE date(created_at) = date('now', 'localtime')
      ORDER BY created_at DESC
    `);
    
    return result.map(this.mapRowToTask);
  }

  async getTodayTasks(): Promise<Task[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const today = new Date().toISOString().split('T')[0];
    const result = await this.db.getAllAsync(`
      SELECT * FROM tasks 
      WHERE date(created_at) = date('now', 'localtime')
      ORDER BY completed ASC, created_at DESC
    `);
    
    return result.map(this.mapRowToTask);
  }

  async createTask(task: Omit<Task, 'id'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.runAsync(`
      INSERT INTO tasks (title, description, completed, created_at, category, priority)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      task.title,
      task.description || '',
      task.completed ? 1 : 0,
      task.createdAt,
      task.category || '',
      task.priority
    ]);
    
    return result.lastInsertRowId;
  }

  async updateTask(id: number, updates: Partial<Task>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const fields = [];
    const values = [];
    
    if (updates.completed !== undefined) {
      fields.push('completed = ?');
      values.push(updates.completed ? 1 : 0);
      if (updates.completed) {
        fields.push('completed_at = ?');
        values.push(new Date().toISOString());
      }
    }
    
    if (fields.length === 0) return;
    
    values.push(id);
    
    await this.db.runAsync(
      `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  async addTask(task: Omit<Task, 'id'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.runAsync(`
      INSERT INTO tasks (title, description, completed, created_at, category, priority)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      task.title,
      task.description || '',
      task.completed ? 1 : 0,
      task.createdAt,
      task.category || '',
      task.priority
    ]);
    
    return result.lastInsertRowId;
  }

  // Journal operations
  async getJournals(): Promise<Journal[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getAllAsync(`
      SELECT * FROM journals 
      ORDER BY date DESC
    `);
    
    return result.map(this.mapRowToJournal);
  }

  async saveJournal(journal: Omit<Journal, 'id'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.runAsync(`
      INSERT OR REPLACE INTO journals 
      (date, title, content, emotion, ai_generated, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      journal.date,
      journal.title || '',
      journal.content,
      journal.emotion,
      journal.aiGenerated ? 1 : 0,
      journal.createdAt,
      journal.updatedAt
    ]);
    
    return result.lastInsertRowId;
  }

  async getDailyProgress(date: string): Promise<DailyProgress> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getFirstAsync(`
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_tasks
      FROM tasks 
      WHERE date(created_at) = ?
    `, [date]) as any;
    
    const totalTasks = result?.total_tasks || 0;
    const completedTasks = result?.completed_tasks || 0;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    return {
      date,
      totalTasks,
      completedTasks,
      completionRate
    };
  }

  private mapRowToTask(row: any): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      completed: row.completed === 1,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      category: row.category,
      priority: row.priority as Task['priority']
    };
  }

  // UserProfile operations
  async getUserProfile(): Promise<UserProfile | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getFirstAsync(`
      SELECT * FROM user_profiles 
      ORDER BY updated_at DESC 
      LIMIT 1
    `) as any;
    
    return result ? this.mapRowToUserProfile(result) : null;
  }

  async createUserProfile(dreamSelf: string, dreamDescription?: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = new Date().toISOString();
    const result = await this.db.runAsync(`
      INSERT INTO user_profiles (dream_self, dream_description, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `, [
      dreamSelf,
      dreamDescription || '',
      now,
      now
    ]);
    
    return result.lastInsertRowId;
  }

  async saveUserProfile(profile: Omit<UserProfile, 'id'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.runAsync(`
      INSERT INTO user_profiles (dream_self, dream_description, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `, [
      profile.dreamSelf,
      profile.dreamDescription || '',
      profile.createdAt,
      profile.updatedAt
    ]);
    
    return result.lastInsertRowId;
  }

  async updateUserProfile(id: number, updates: Partial<UserProfile>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const fields = [];
    const values = [];
    
    if (updates.dreamSelf !== undefined) {
      fields.push('dream_self = ?');
      values.push(updates.dreamSelf);
    }
    
    if (updates.dreamDescription !== undefined) {
      fields.push('dream_description = ?');
      values.push(updates.dreamDescription);
    }
    
    if (fields.length === 0) return;
    
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    
    await this.db.runAsync(
      `UPDATE user_profiles SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  private mapRowToUserProfile(row: any): UserProfile {
    return {
      id: row.id,
      dreamSelf: row.dream_self,
      dreamDescription: row.dream_description,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRowToJournal(row: any): Journal {
    return {
      id: row.id,
      date: row.date,
      title: row.title,
      content: row.content,
      emotion: row.emotion as Journal['emotion'],
      aiGenerated: row.ai_generated === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // Conversation operations
  async saveConversation(conversation: Omit<Conversation, 'id'>): Promise<Conversation> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.runAsync(
      `INSERT INTO conversations (user_id, user_message, ai_response, timestamp, emotion, topic) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [conversation.userId, conversation.userMessage, conversation.aiResponse, conversation.timestamp, conversation.emotion || null, conversation.topic || null]
    );

    return {
      id: result.lastInsertRowId!.toString(),
      ...conversation
    };
  }

  async getTodaysConversations(date?: string): Promise<Conversation[]> {
    if (!this.db) throw new Error('Database not initialized');

    const targetDate = date || new Date().toISOString().split('T')[0];
    const startTime = `${targetDate}T00:00:00`;
    const endTime = `${targetDate}T23:59:59`;

    const result = await this.db.getAllAsync(
      `SELECT * FROM conversations 
       WHERE timestamp >= ? AND timestamp <= ? 
       ORDER BY timestamp ASC`,
      [startTime, endTime]
    );

    return result.map(this.mapRowToConversation);
  }

  async getRecentConversations(limit: number = 10): Promise<Conversation[]> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getAllAsync(
      `SELECT * FROM conversations 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [limit]
    );

    return result.map(this.mapRowToConversation);
  }

  private mapRowToConversation(row: any): Conversation {
    return {
      id: row.id.toString(),
      userId: row.user_id,
      userMessage: row.user_message,
      aiResponse: row.ai_response,
      timestamp: row.timestamp,
      emotion: row.emotion,
      topic: row.topic
    };
  }
}

export default new DatabaseService();
