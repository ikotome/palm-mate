export interface Task {
  id: number;
  title: string;
  description?: string;
  // 互換のため completed は残す（status === 'done' のとき true）
  completed: boolean;
  // 新しい三状態: todo | done | skipped(やらない)
  status?: 'todo' | 'done' | 'skipped';
  createdAt: string;
  completedAt?: string;
  category?: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string; // 期限（YYYY-MM-DD または ISO）
}

export interface DailyProgress {
  date: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
}
