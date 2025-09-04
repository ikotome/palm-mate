// アプリ共通のミニマルテーマ
export const theme = {
  colors: {
    background: '#F8FAFC', // 背景（わずかに青みのあるオフホワイト）
    surface: '#FFFFFF', // カード/コンテナ
    text: '#111827', // プライマリテキスト（近い黒）
    subtext: '#6B7280', // セカンダリテキスト（グレー）
    border: '#E5E7EB', // 枠線
    muted: '#F3F4F6', // うすい塗り
    accent: '#10B981', // アクセント（エメラルド）
    accentSoft: '#ECFDF5', // アクセントの淡色背景
  purple: '#8B5CF6', // 完了時のチェックボックス用（バイオレット）
  },
  radius: {
    s: 8,
    m: 12,
    l: 16,
    pill: 999,
  },
  spacing: {
    xs: 4,
    s: 8,
    m: 12,
    l: 16,
    xl: 24,
  },
};

export type AppTheme = typeof theme;
