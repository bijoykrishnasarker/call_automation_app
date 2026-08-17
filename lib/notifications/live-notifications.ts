import type { Notification, NavigationItem } from '@/types';

const STORAGE_PREFIX = 'leadops_notifications_';
const MAX_NOTIFICATIONS = 50;

export type LiveNotificationInput = {
  title: string;
  message: string;
  type?: Notification['type'];
  linkTo: NavigationItem;
  entityId?: string;
  subTab?: Notification['subTab'];
};

export function createLiveNotification(input: LiveNotificationInput): Notification {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    message: input.message,
    time: 'Just now',
    read: false,
    type: input.type ?? 'info',
    linkTo: input.linkTo,
    entityId: input.entityId,
    subTab: input.subTab,
  };
}

export function loadStoredNotifications(userId: string): Notification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Notification[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_NOTIFICATIONS) : [];
  } catch {
    return [];
  }
}

export function saveStoredNotifications(userId: string, items: Notification[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    /* ignore quota errors */
  }
}

export function prependNotification(
  current: Notification[],
  input: LiveNotificationInput
): Notification[] {
  return [createLiveNotification(input), ...current].slice(0, MAX_NOTIFICATIONS);
}

export function maybeShowBrowserNotification(title: string, message: string): void {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body: message });
  } catch {
    /* ignore */
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}
