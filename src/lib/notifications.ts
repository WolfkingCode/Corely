/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

declare global {
  interface Window {
    corelyDesktop?: {
      isDesktop?: boolean;
      showNotification?: (opts: { title: string; body: string; icon?: string }) => void;
      setDns?: (opts: { primary?: string; secondary?: string; reset?: boolean }) => Promise<{ success: boolean; error?: string }>;
      getDns?: () => Promise<{ primary: string | null; secondary?: string | null }>;
      isAdmin?: () => Promise<boolean>;
      getAutoStart?: () => Promise<boolean>;
      setAutoStart?: (enabled: boolean) => Promise<boolean>;
      window?: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
        isMaximized: () => Promise<boolean>;
        onMaximizedChange: (cb: (val: boolean) => void) => void;
      };
    };
  }
}

// In-memory cache to deduplicate identical notifications within 5 seconds
const recentNotifications = new Map<string, number>();
const DEDUPE_INTERVAL_MS = 5000;

/**
 * Checks whether the app is running within the desktop container
 */
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && window.corelyDesktop?.isDesktop === true;
}

/**
 * Requests or confirms browser / desktop notification permissions
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (isDesktopApp()) {
      return true;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Checks whether the current time falls within user-configured quiet hours
 */
export function isQuietHours(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const raw = localStorage.getItem('v3_settings');
    if (!raw) return false;
    const settings: {
      quietHoursEnabled?: boolean;
      quietHoursStart?: string;
      quietHoursEnd?: string;
    } = JSON.parse(raw);

    if (!settings || !settings.quietHoursEnabled) return false;

    const startStr = typeof settings.quietHoursStart === 'string' ? settings.quietHoursStart : '23:00';
    const endStr = typeof settings.quietHoursEnd === 'string' ? settings.quietHoursEnd : '07:00';

    const [startH, startM] = startStr.split(':').map((v: string) => parseInt(v, 10) || 0);
    const [endH, endM] = endStr.split(':').map((v: string) => parseInt(v, 10) || 0);

    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    const now = new Date();
    const nowTotal = now.getHours() * 60 + now.getMinutes();

    if (startTotal === endTotal) {
      return false;
    }

    if (startTotal < endTotal) {
      return nowTotal >= startTotal && nowTotal < endTotal;
    } else {
      return nowTotal >= startTotal || nowTotal < endTotal;
    }
  } catch {
    return false;
  }
}

/**
 * Dispatches a notification across desktop or web browser with deduplication
 */
export async function notify(opts: { title: string; body: string }): Promise<boolean> {
  try {
    if (isQuietHours()) {
      return false;
    }

    const { title, body } = opts;
    const now = Date.now();
    const dedupeKey = `${title}:::${body}`;

    const lastSent = recentNotifications.get(dedupeKey);
    if (lastSent && now - lastSent < DEDUPE_INTERVAL_MS) {
      return false;
    }

    // Prune stale cache entries if map grows
    if (recentNotifications.size > 50) {
      for (const [key, timestamp] of recentNotifications.entries()) {
        if (now - timestamp > DEDUPE_INTERVAL_MS) {
          recentNotifications.delete(key);
        }
      }
    }

    recentNotifications.set(dedupeKey, now);

    if (isDesktopApp()) {
      window.corelyDesktop?.showNotification?.({ title, body });
      return true;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    if (Notification.permission !== 'granted') {
      return false;
    }

    const notification = new Notification(title, {
      body,
      silent: false
    });

    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // Ignore focus errors
      }
    };

    return true;
  } catch {
    return false;
  }
}
