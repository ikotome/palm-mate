import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, View, StyleSheet, ScrollView, TouchableOpacity, LayoutChangeEvent, Text } from 'react-native';
import { theme } from '../../styles/theme';
import { useRouter } from 'expo-router';
import DatabaseService from '../../services/DatabaseService';
import { Journal } from '../../models/JournalModel';

export default function JournalSummaryScreen() {
  const router = useRouter();
  const [journals, setJournals] = useState<Journal[]>([]);
  const goToDate = (d: string) => router.push({ pathname: '/journal/[date]' as any, params: { date: d } });
  // 日毎の完了タスク数
  const [dailyCounts, setDailyCounts] = useState<Record<string, number>>({});
  // 無限スクロール: 可視日数（初期60日）
  const [visibleDays, setVisibleDays] = useState<number>(60);
  const loadingMoreRef = useRef(false);
  // アプリ開始日（これより前はランダム色）
  const [appStartDate, setAppStartDate] = useState<string | null>(null);
  // 初期表示で画面いっぱいにするためのフラグ
  const initialSizedRef = useRef(false);
  // グリッド列数（セルサイズが固定なので、列数から追加行の高さを推定可能）
  const [gridCols, setGridCols] = useState<number>(1);
  const CELL = 22;
  const GAP = 4;
  const PAD = 12; // contentContainer の padding と合わせる
  const scrollRef = useRef<any>(null);
  const lastScrollYRef = useRef(0);
  const pendingPrependRowsRef = useRef(0);
  const initialScrolledRef = useRef(false);
  const lastLongPressRef = useRef(0);
  const tooltipTimerRef = useRef<any>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const TOOLTIP_W = 180;
  const TOOLTIP_H = 48;
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    left: number;
    top: number;
    date: string;
    count: number;
    hasJournal: boolean;
  }>({ visible: false, left: 0, top: 0, date: '', count: 0, hasJournal: false });

  useEffect(() => {
    const load = async () => {
      const [js, start] = await Promise.all([
        DatabaseService.getJournals(),
        DatabaseService.getAppStartDate(),
      ]);
      setJournals(js);
      setAppStartDate(start);
    };
    load();
  }, []);

  // 今日から visibleDays-1 日前までの配列（古い→新しい順）
  const visibleDateRange = useMemo(() => {
    return Array.from({ length: visibleDays }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (visibleDays - 1 - i));
      return d.toISOString().split('T')[0];
    });
  }, [visibleDays]);

  // 可視範囲の完了タスク数を増分取得
  useEffect(() => {
    let mounted = true;
    const loadIncrementalCounts = async () => {
      const targets = visibleDateRange.filter(d => dailyCounts[d] === undefined);
      if (targets.length === 0) return;
      const entries = await Promise.all(
        targets.map(async (date) => {
          const tasks = await DatabaseService.getCompletedTasksByDate(date);
          return [date, tasks.length] as const;
        })
      );
      if (!mounted) return;
      setDailyCounts(prev => {
        const m = { ...prev } as Record<string, number>;
        for (const [d, c] of entries) m[d] = c;
        return m;
      });
    };
    loadIncrementalCounts();
    return () => { mounted = false; };
  }, [visibleDateRange, dailyCounts]);

  // 可視日数が増えた（上に過去日を足した）直後に、追加行の高さ分だけスクロール位置を補正
  useEffect(() => {
    if (pendingPrependRowsRef.current > 0) {
      const deltaY = pendingPrependRowsRef.current * (CELL + GAP);
      const targetY = Math.max(0, lastScrollYRef.current + deltaY);
      scrollRef.current?.scrollTo({ y: targetY, animated: false });
      pendingPrependRowsRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleDays]);

  const journalDates = useMemo(() => new Set(journals.map(j => j.date)), [journals]);

  // タスク数に応じた色（0=グレー、1~薄緑、増えるほど濃く）
  const getCountColor = (count: number) => {
    if (count >= 7) return '#04a609';
    if (count >= 6) return '#1daf22';
    if (count >= 5) return '#36b83a';
    if (count >= 4) return '#4fc153';
    if (count >= 3) return '#68ca6b';
    if (count >= 2) return '#82d384';
    if (count >= 1) return '#9bdb9d';
    return '#e6f6e6';
  };

  // 安定ランダム色（開始日より前に適用）
  const getRandomColorForDate = (date: string) => {
    const palette = ['#e8f5e9', '#e3f2fd', '#fff3e0', '#f3e5f5', '#e0f7fa', '#fce4ec', '#ede7f6', '#f1f8e9'];
    let hash = 0;
    for (let i = 0; i < date.length; i++) hash = (hash * 31 + date.charCodeAt(i)) | 0;
    const idx = Math.abs(hash) % palette.length;
    return palette[idx];
  };

  const getCellColor = (date: string, count: number) => {
    if (appStartDate && date < appStartDate) return getRandomColorForDate(date);
    return getCountColor(count);
  };

  const handleCellLongPress = (date: string, count: number, hasJournal: boolean, index: number) => {
    lastLongPressRef.current = Date.now();
    // インデックスから座標を計算（contentContainerのpaddingを考慮）
    const col = Math.max(0, index % Math.max(1, gridCols));
    const row = Math.max(0, Math.floor(index / Math.max(1, gridCols)));
  const cellLeft = PAD + col * (CELL + GAP);
  const cellTop = PAD + row * (CELL + GAP);

    // ツールチップ位置（デフォはセル上に表示、上端近い場合は下に）
  const tipWidth = TOOLTIP_W;
  const tipHeight = TOOLTIP_H;
  let left = cellLeft + CELL / 2 - tipWidth / 2;
  const minLeft = PAD;
  const maxLeft = containerWidth > 0 ? Math.max(minLeft, containerWidth - PAD - tipWidth) : undefined;
  if (left < minLeft) left = minLeft;
  if (maxLeft !== undefined && left > maxLeft) left = maxLeft;
  let top = cellTop - tipHeight - 6;
  if (top < 8) top = cellTop + CELL + 6;

    // 表示
    setTooltip({ visible: true, left, top, date, count, hasJournal });
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(() => {
      setTooltip(t => ({ ...t, visible: false }));
    }, 1800);
  };

  const handleCellPress = (date: string) => {
    // 長押し直後の誤タップ遷移を抑止
    if (Date.now() - lastLongPressRef.current < 600) return;
    goToDate(date);
  };

  const onScroll = (e: any) => {
    const { contentOffset } = e.nativeEvent;
    lastScrollYRef.current = contentOffset.y;
    // スクロール中はツールチップを閉じる
    if (tooltip.visible) setTooltip(t => ({ ...t, visible: false }));
    const paddingToTop = 12; // 上端しきい値
    const nearTop = contentOffset.y <= paddingToTop;
    if (nearTop && !loadingMoreRef.current) {
      loadingMoreRef.current = true;
      // 追加ロード（60日ずつ、さらに過去を追加）
      const chunk = 60;
      const cols = Math.max(1, gridCols);
      const rowsAdded = Math.ceil(chunk / cols);
      pendingPrependRowsRef.current += rowsAdded;
      setVisibleDays(prev => prev + chunk);
      // 少し待ってからロック解除
      setTimeout(() => { loadingMoreRef.current = false; }, 300);
    }
  };

  // 初期表示で画面を埋めるため、レイアウトから可視日数を計算
  const onContainerLayout = (e: LayoutChangeEvent) => {
  const { width, height } = e.nativeEvent.layout;
  setContainerWidth(width);
  if (initialSizedRef.current) return;
  const cols = Math.max(1, Math.floor((width + GAP) / (CELL + GAP)));
  setGridCols(cols);
    const rows = Math.max(1, Math.ceil((height + GAP) / (CELL + GAP)));
    const needed = cols * rows + cols * 2; // 余裕を少し追加
    setVisibleDays(prev => Math.max(prev, needed));
    initialSizedRef.current = true;
  };

  // 初回は最下部を表示（最新日付が見えるように）
  const onContentSizeChange = () => {
    if (!initialScrolledRef.current && initialSizedRef.current) {
      initialScrolledRef.current = true;
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      }, 0);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
  onContentSizeChange={onContentSizeChange}
        onLayout={onContainerLayout}
      >
        <View style={styles.heatmapContainer}>
          <View style={styles.heatmapGrid}>
            {visibleDateRange.map((date, index) => {
              const count = dailyCounts[date] ?? 0;
              const hasJournal = journalDates.has(date);
              const color = getCellColor(date, count);
              return (
                <TouchableOpacity
                  key={date}
                  style={[
                    styles.heatmapCell,
                    { backgroundColor: color },
                    hasJournal ? styles.heatmapCellWithJournal : null,
                  ]}
                  onPress={() => handleCellPress(date)}
                  onLongPress={() => handleCellLongPress(date, count, hasJournal, index)}
                />
              );
            })}
          </View>
          {tooltip.visible && (
            <View
              pointerEvents="none"
              style={[
                styles.tooltip,
                { left: tooltip.left, top: tooltip.top },
              ]}
            >
              <View style={styles.tooltipInner}>
                <View style={styles.tooltipDot} />
                <View>
                  <Text style={styles.tooltipTitle}>{tooltip.date}</Text>
                  <Text style={styles.tooltipText}>完了タスク: {tooltip.count}／日記: {tooltip.hasJournal ? 'あり' : 'なし'}</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { flex: 1 },
  contentContainer: { flexGrow: 1, padding: 12 },
  heatmapContainer: { flex: 1 },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heatmapCell: { width: 22, height: 22, borderRadius: 4 },
  heatmapCellWithJournal: { borderWidth: 2, borderColor: theme.colors.text },
  tooltip: { position: 'absolute', zIndex: 10, minWidth: 140, maxWidth: 220 },
  tooltipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    width: 180,
  },
  tooltipDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.text, opacity: 0.3 },
  tooltipTitle: { fontWeight: '700', color: theme.colors.text },
  tooltipText: { color: theme.colors.subtext, marginTop: 2 },
  // 不要なスタイルは削除
});
