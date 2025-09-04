export interface UserProfile {
  id: number;
  dreamSelf: string; // 憧れの自分
  dreamDescription?: string; // 詳細説明
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingData {
  dreamSelf: string;
  dreamDescription?: string;
  completed: boolean;
}
