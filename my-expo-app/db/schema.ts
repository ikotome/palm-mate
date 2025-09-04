import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// tasks テーブル
export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  completed: integer('completed').notNull().default(0), // 0/1
  createdAt: text('created_at').notNull(), // ISO string
  completedAt: text('completed_at'),
  category: text('category'),
  priority: text('priority').notNull().default('medium'), // 'low' | 'medium' | 'high'
  dueDate: text('due_date'), // YYYY-MM-DD 推奨（ISOでも可）
});

// user_profiles テーブル
export const userProfiles = sqliteTable('user_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dreamSelf: text('dream_self').notNull(),
  dreamDescription: text('dream_description'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// journals テーブル（date をユニークにして upsert 可能に）
export const journals = sqliteTable('journals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  title: text('title'),
  content: text('content').notNull(),
  emotion: text('emotion').notNull(),
  aiGenerated: integer('ai_generated').notNull().default(0), // 0/1
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// conversations テーブル
export const conversations = sqliteTable('conversations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().default('default'),
  userMessage: text('user_message').notNull(),
  aiResponse: text('ai_response').notNull(),
  timestamp: text('timestamp').notNull(),
  emotion: text('emotion'),
  topic: text('topic'),
});

// ヘルパー: 当日範囲の計算（ローカルタイム）
export function getDayRangeISO(date?: string) {
  const d = date ? new Date(date) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const start = `${yyyy}-${mm}-${dd}T00:00:00`;
  const end = `${yyyy}-${mm}-${dd}T23:59:59`;
  return { start, end };
}
