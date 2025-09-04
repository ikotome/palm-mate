// 日付ユーティリティ（日本時間ベース）

// YYYY-MM-DD を Asia/Tokyo で返す
export function jstDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

// 指定した日本日付(YYYY-MM-DD)の1日のUTC境界をISO(Z)で返す
export function getJstDayUtcRange(date?: string): { start: string; end: string } {
  const day = date || jstDateString();
  const start = new Date(`${day}T00:00:00+09:00`).toISOString();
  const end = new Date(`${day}T23:59:59+09:00`).toISOString();
  return { start, end };
}
