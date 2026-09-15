import { Platform } from 'react-native';
import Constants from 'expo-constants';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';
export const DAILY_REMINDER_TYPE = 'daily-reminder';

const ANDROID_CHANNEL_ID = 'daily-reminder';

type NotificationsModule = typeof import('expo-notifications');

// Android + Expo Go'da (SDK 53+) expo-notifications'ı require etmenin kendisi native
// tarafta fatal bir hataya yol açıyor ve bu, normal bir JS throw değil — try/catch'e
// alınan require() çağrısı bile yakalayamıyor (denendi, çökmeye devam etti). Tek güvenli
// yol: modülü hiç require ETMEDEN önce ortamı kontrol edip, destekliyorsa require etmek.
function isEnvironmentSupported(): boolean {
  if (Platform.OS !== 'android') return true;
  return Constants.appOwnership !== 'expo';
}

let notificationsModule: NotificationsModule | null | undefined;

function loadNotifications(): NotificationsModule | null {
  if (notificationsModule !== undefined) return notificationsModule;
  if (!isEnvironmentSupported()) {
    notificationsModule = null;
    return null;
  }
  try {
    const mod = require('expo-notifications') as NotificationsModule;
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    notificationsModule = mod;
  } catch (error) {
    console.warn('expo-notifications kullanılamıyor:', error);
    notificationsModule = null;
  }
  return notificationsModule;
}

async function ensureAndroidChannel(Notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Günlük Hatırlatma',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getNotificationPermissionStatus(): Promise<PermissionStatus> {
  const Notifications = loadNotifications();
  if (!Notifications) return 'unsupported';
  const result = await Notifications.getPermissionsAsync();
  if (result.granted) return 'granted';
  return result.status === 'denied' ? 'denied' : 'undetermined';
}

export async function requestNotificationPermission(): Promise<PermissionStatus> {
  const Notifications = loadNotifications();
  if (!Notifications) return 'unsupported';
  const result = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  if (result.granted) return 'granted';
  return result.status === 'denied' ? 'denied' : 'undetermined';
}

export async function scheduleDailyReminder(
  hour: number,
  minute: number,
  content: { title: string; body: string }
): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  await ensureAndroidChannel(Notifications);
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      data: { type: DAILY_REMINDER_TYPE },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
    },
  });
}

export async function cancelDailyReminder(): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getLastNotificationResponseType(): Promise<string | undefined> {
  const Notifications = loadNotifications();
  if (!Notifications) return undefined;
  const response = await Notifications.getLastNotificationResponseAsync();
  const data = response?.notification.request.content.data as { type?: string } | undefined;
  return data?.type;
}

export function addNotificationResponseListener(
  onType: (type: string | undefined) => void
): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) return () => {};
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { type?: string } | undefined;
    onType(data?.type);
  });
  return () => subscription.remove();
}
