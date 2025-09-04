export interface Conversation {
  id: string;
  userId: string;
  userMessage: string;
  aiResponse: string;
  timestamp: string;
  emotion?: string;
  topic?: string;
}

export interface ConversationSummary {
  date: string;
  totalMessages: number;
  mainTopics: string[];
  overallMood: string;
  keyInsights: string[];
}
