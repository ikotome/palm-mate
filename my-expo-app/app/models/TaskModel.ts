export interface Task {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
  category?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface DailyProgress {
  date: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
}
