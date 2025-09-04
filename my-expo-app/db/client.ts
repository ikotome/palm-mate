import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

// 旧APIの同期 open（drizzle で必要）
export const sqliteDb = openDatabaseSync('palmmate.db');

// Drizzle クライアント
export const db = drizzle(sqliteDb);
