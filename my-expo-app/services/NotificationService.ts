import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Task } from '../models/TaskModel';

type NightlyOptions = {
  hour?: number; // local time hour
  minute?: number; // local time minute
  title?: string;
  body?: string;
};

const NIGHTLY_DATA_TYPE = 'nightly-reminder';
const ANDROID_CHANNEL_ID = 'default';
const TASK_DUE_DATA_TYPE = 'task-due';
const TASK_DUE_KEY_PREFIX = 'task-due-'; // SecureStore key prefix

class NotificationService {
  private initialized = false;
  private responseListener?: Notifications.Subscription;
  private receiveListener?: Notifications.Subscription;

  async init() {
    if (this.initialized) return;

    // フォアグラウンドでもバナーを表示
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        // web 向けのフィールド（型満たし）
        shouldShowBanner: true as any,
        shouldShowList: true as any,
      } as any),
    });

    // Androidはチャンネル必須
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
          name: 'General',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      } catch {}
    }

    this.initialized = true;
  }

  async ensurePermission(): Promise<boolean> {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  async scheduleNightlyReminder(opts: NightlyOptions = {}): Promise<string | null> {
    const ok = await this.ensurePermission();
    if (!ok) return null;

    const hour = opts.hour ?? 22;
    const minute = opts.minute ?? 0;
    const title = opts.title ?? '1日の振り返り時間です';
    const body = opts.body ?? '今日の出来事を短くメモしよう📝 PalmMateが手伝います。';

    // 既存の夜間リマインダーをクリアして二重登録を防ぐ
    await this.cancelNightlyReminder();

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: NIGHTLY_DATA_TYPE },
      },
      // 型差異を吸収（SDK や型定義の違いに対応）
      trigger: ({
        hour,
        minute,
        repeats: true,
        channelId: Platform.OS === 'android' ? ANDROID_CHANNEL_ID : undefined,
      } as unknown) as Notifications.NotificationTriggerInput,
    });
    return identifier;
  }

  // Expo push token (for remote notifications via Expo) — requires development build on SDK 53+
  async getExpoPushToken(): Promise<string | null> {
    const ok = await this.ensurePermission();
    if (!ok) return null;

    // projectId は EAS に紐づいた値。開発ビルドでは Constants.expoConfig?.extra?.eas?.projectId、
    // 本番ビルドでは Constants.easConfig?.projectId が入る想定。
    const projectId =
      (Constants as any)?.expoConfig?.extra?.eas?.projectId ?? (Constants as any)?.easConfig?.projectId;

    try {
      const res = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      return res.data;
    } catch (e) {
      // SDK 53 で Expo Go では失敗する（開発ビルドが必要）
      return null;
    }
  }

  addListeners(
    onReceive?: (n: Notifications.Notification) => void,
    onResponse?: (r: Notifications.NotificationResponse) => void
  ) {
    this.removeListeners();
    if (onReceive) {
      this.receiveListener = Notifications.addNotificationReceivedListener(onReceive);
    }
    if (onResponse) {
      this.responseListener = Notifications.addNotificationResponseReceivedListener(onResponse);
    }
  }

  removeListeners() {
    this.receiveListener?.remove();
    this.responseListener?.remove();
    this.receiveListener = undefined;
    this.responseListener = undefined;
  }

  async cancelNightlyReminder(): Promise<void> {
    const list = await Notifications.getAllScheduledNotificationsAsync();
    const targets = list.filter((n) => (n.content?.data as any)?.type === NIGHTLY_DATA_TYPE);
    await Promise.all(targets.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  }

  async isNightlyReminderScheduled(): Promise<boolean> {
    const list = await Notifications.getAllScheduledNotificationsAsync();
    return list.some((n) => (n.content?.data as any)?.type === NIGHTLY_DATA_TYPE);
  }

  async setNightlyReminderEnabled(enabled: boolean, opts?: NightlyOptions): Promise<boolean> {
    if (enabled) {
      const id = await this.scheduleNightlyReminder(opts);
      return !!id;
    } else {
      await this.cancelNightlyReminder();
      return true;
    }
  }

  // ---- Task due notifications ----
  /**
   * タスクの期限に1回だけ通知をスケジュールします。
   * - dueDate が過去、completed/skipped の場合はスキップ
   * - 既存の同タスク通知があればキャンセルして置き換え
   * - dueDate が「YYYY-MM-DD」だけの場合は、その日の20:00で通知（仮定）
   */
  async scheduleTaskDueNotification(task: Task): Promise<string | null> {
    const ok = await this.ensurePermission();
    if (!ok) return null;

    // 状態チェック
    if (!task.dueDate) return null;
    if (task.completed || task.status === 'skipped') {
      await this.cancelTaskDueNotification(task.id).catch(() => {});
      return null;
    }

    // 日付パース（YYYY-MM-DD or ISO）
    let target = task.dueDate;
    const onlyDate = /^\d{4}-\d{2}-\d{2}$/.test(target);
    if (onlyDate) {
      // 20:00 ローカル基準に仮で設定
      target = `${target}T20:00:00`;
    }
    const when = new Date(target);
    if (Number.isNaN(when.getTime())) return null;
    if (when.getTime() <= Date.now()) {
      // 過去はスキップ（必要なら直近数分なら即時に変える等の調整可能）
      await this.cancelTaskDueNotification(task.id).catch(() => {});
      return null;
    }

    // 既存をキャンセル
    await this.cancelTaskDueNotification(task.id).catch(() => {});

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ 締め切りです',
        body: task.title,
        data: { type: TASK_DUE_DATA_TYPE, taskId: task.id },
      },
      trigger: (when as unknown) as Notifications.NotificationTriggerInput,
    });

    // 保存
    try { await SecureStore.setItemAsync(TASK_DUE_KEY_PREFIX + String(task.id), identifier); } catch {}
    return identifier;
  }

  async cancelTaskDueNotification(taskId: number): Promise<void> {
    try {
      const key = TASK_DUE_KEY_PREFIX + String(taskId);
      const id = await SecureStore.getItemAsync(key);
      if (id) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
      await SecureStore.deleteItemAsync(key);
    } catch {}
  }

  /**
   * 渡されたタスクリストの期限通知を再構成（不要なものをキャンセルし、必要なものをスケジュール）。
   */
  async rescheduleDueNotificationsForTasks(list: Task[]): Promise<void> {
    const ops: Promise<any>[] = [];
    for (const t of list) {
      if (t.dueDate && !t.completed && t.status !== 'skipped') {
        ops.push(this.scheduleTaskDueNotification(t));
      } else {
        ops.push(this.cancelTaskDueNotification(t.id));
      }
    }
    await Promise.allSettled(ops);
  }
}

export default new NotificationService();
