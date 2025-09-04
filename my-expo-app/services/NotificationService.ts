import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

type NightlyOptions = {
  hour?: number; // local time hour
  minute?: number; // local time minute
  title?: string;
  body?: string;
};

const NIGHTLY_DATA_TYPE = 'nightly-reminder';
const ANDROID_CHANNEL_ID = 'default';

class NotificationService {
  private initialized = false;

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
}

export default new NotificationService();
