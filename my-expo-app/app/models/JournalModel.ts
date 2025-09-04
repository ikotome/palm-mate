export interface Journal {
  id: number;
  date: string;
  title?: string;
  content: string;
  emotion: 'happy' | 'excited' | 'peaceful' | 'thoughtful' | 'grateful' | 'determined' | 'confident' | 'curious' | 'content' | 'hopeful' | 'sad' | 'angry' | 'calm' | 'neutral';
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmotionData {
  date: string;
  emotion: Journal['emotion'];
  intensity: number; // 1-5 scale
}
