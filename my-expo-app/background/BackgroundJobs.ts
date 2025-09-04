import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as SecureStore from 'expo-secure-store';
import StackChanService from '../services/StackChanService';

// タスク名は固定文字列で管理
export const NIGHT_JOB_TASK = 'nightly-stackchan-job';

// 一日一回の実行制御用キー
const LAST_RUN_KEY = 'nightly-stackchan-last-run';

// 実行ウィンドウ設定（22:00±60分）
const TARGET_HOUR = 22;
const WINDOW_MINUTES = 60; // 前後1時間

function isInWindow(now: Date) {
  const localHour = now.getHours();
  const localMinutes = now.getMinutes();
  // 22:00 を中心に±60分 → 21:00〜23:00 の範囲
  const total = localHour * 60 + localMinutes;
  const start = (TARGET_HOUR - 1) * 60;
  const end = (TARGET_HOUR + 1) * 60;
  return total >= start && total <= end;
}

async function hasRunToday(now: Date) {
  try {
    const last = await SecureStore.getItemAsync(LAST_RUN_KEY);
    if (!last) return false;
    const lastDate = new Date(last);
    return (
      now.getFullYear() === lastDate.getFullYear() &&
      now.getMonth() === lastDate.getMonth() &&
      now.getDate() === lastDate.getDate()
    );
  } catch {
    return false;
  }
}

async function markRun(now: Date) {
  try {
    await SecureStore.setItemAsync(LAST_RUN_KEY, now.toISOString());
  } catch {}
}

// グローバルスコープでタスク定義
TaskManager.defineTask(NIGHT_JOB_TASK, async () => {
  try {
    const now = new Date();
    const inWindow = isInWindow(now);
    const already = await hasRunToday(now);

    if (inWindow && !already) {
      // StackChan が未接続でも初期化を試みる
      try {
        await StackChanService.reconnect();
      } catch {}

      // 必要に応じて内容は後で差し替え可能
      const res = await StackChanService.sendNightlyNotification('');
      if (res.success) {
        await markRun(now);
      }
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (e) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// タスク登録ヘルパー
export async function registerNightlyJob() {
  const isDefined = TaskManager.isTaskDefined(NIGHT_JOB_TASK);
  if (!isDefined) {
    // defineTask は既にこのファイル先頭で実行済み
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(NIGHT_JOB_TASK);
  if (!isRegistered) {
    await BackgroundFetch.registerTaskAsync(NIGHT_JOB_TASK, {
      minimumInterval: 60 * 15, // 最短15分間隔（OS裁量で変動）
      stopOnTerminate: false, // Androidでアプリ強制終了後も継続
      startOnBoot: true, // Android再起動後も継続
    });
  }
}

export async function unregisterNightlyJob() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(NIGHT_JOB_TASK);
  if (isRegistered) {
    await BackgroundFetch.unregisterTaskAsync(NIGHT_JOB_TASK);
  }
}
