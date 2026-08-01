import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../supabase/supabase';

// expo-notifications was removed from Expo Go (SDK 53+). A static import would
// crash at module load time there, so we require it dynamically and fall back
// to a no-op stub when it is unavailable (e.g. running in Expo Go).
let Notifications: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Notifications = require('expo-notifications');
} catch (_) {
  Notifications = {
    setNotificationHandler: () => {},
    getPermissionsAsync: async () => ({ status: 'denied' }),
    requestPermissionsAsync: async () => ({ status: 'denied' }),
    getExpoPushTokenAsync: async () => ({ data: null }),
    addNotificationReceivedListener: () => ({ remove: () => {} }),
    addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
  };
}

/**
 * Push notifications require a development build or standalone app. In the Expo
 * Go sandbox, `expo-notifications` is unavailable and would throw at runtime, so
 * we detect that environment and skip all push setup.
 */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.ExpoGo;
}

/**
 * Configures how notifications are presented while the app is in the foreground.
 */
export function setPushNotificationHandler(): void {
  if (isExpoGo()) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Guards against firing `getExpoPushTokenAsync` multiple times in parallel.
// Calling it repeatedly (e.g. from a re-running effect or React StrictMode in
// dev) aborts the in-flight request and surfaces a
// "Fetch request has been canceled" warning from expo-notifications. Sharing a
// single in-flight promise ensures only one token request is ever outstanding.
let tokenPromise: Promise<string | null> | null = null;

/**
 * Requests permission (if needed) and resolves the Expo push token, or null if
 * push notifications are unavailable (e.g. Expo Go, unsupported emulator) or denied.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (isExpoGo()) {
    // Expo Go does not support push notifications; avoid loading the module path.
    return null;
  }
  if (!Device.isDevice) {
    // Push tokens can only be issued to physical devices.
    console.warn('Push notifications are unavailable on this device/simulator.');
    return null;
  }

  // If a token request is already in flight, reuse it instead of starting a
  // second one that would abort the first.
  if (tokenPromise) {
    return tokenPromise;
  }

  tokenPromise = (async () => {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Push notification permissions not granted.');
      return null;
    }

    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : {}
      );
      return tokenResponse.data;
    } catch (e: any) {
      // A canceled/aborted fetch is harmless and happens when a duplicate
      // token request is superseded by this one — don't surface it as a warning.
      const message = e?.message ?? '';
      if (e?.name === 'AbortError' || /canceled|aborted|abort/i.test(message)) {
        return null;
      }
      console.warn('Failed to obtain Expo push token:', e);
      return null;
    }
  })();

  try {
    return await tokenPromise;
  } finally {
    // Clear the in-flight marker once settled so a later, legitimate request
    // (e.g. after a token refresh) can be made again.
    tokenPromise = null;
  }
}

/**
 * The Expo "experience id" (e.g. @owner/slug) this app belongs to. The admin
 * and customer apps share the push_tokens table but are separate Expo projects,
 * so we tag each token with its experience to avoid mixing tokens from different
 * projects in a single Expo push request (which Expo rejects with
 * PUSH_TOO_MANY_EXPERIENCE_IDS).
 */
export function getExperienceId(): string | null {
  const config = Constants.expoConfig;
  if (!config) return null;
  const owner = config.owner ?? (config as any).extra?.eas?.owner;
  const slug = config.slug;
  if (owner && slug) return `@${owner}/${slug}`;
  return null;
}

/**
 * Persists the device push token for the current user so the backend can target it.
 * Tags it with this app's experience id.
 */
export async function savePushToken(userId: string, token: string): Promise<void> {
  const experienceId = getExperienceId();
  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, token, platform: Platform.OS, experience_id: experienceId },
      { onConflict: 'user_id' }
    );
  if (error) {
    console.warn('Failed to save push token:', error.message);
  }
}

/**
 * Registers for push notifications and stores the token for the given user.
 */
export async function registerAndSaveToken(userId: string | undefined): Promise<void> {
  if (!userId) return;
  if (isExpoGo()) return;
  setPushNotificationHandler();
  const token = await registerForPushNotificationsAsync();
  if (token) {
    await savePushToken(userId, token);
  }
}

/**
 * Subscribes to push notification events. `onTap` is invoked when the user taps
 * a notification (used to deep-link into the app, e.g. the Notifications screen).
 * Returns a cleanup function that removes the listeners.
 */
export function addPushNotificationListeners(onTap: () => void): () => void {
  if (isExpoGo()) return () => {};
  const receivedSub = Notifications.addNotificationReceivedListener(() => {
    // Foreground delivery: the in-app inbox will refresh on next visit.
  });
  const responseSub = Notifications.addNotificationResponseReceivedListener(() => {
    onTap();
  });
  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}