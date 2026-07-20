import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../supabase/supabase';

/**
 * Configures how notifications are presented while the app is in the foreground.
 */
export function setPushNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Requests permission (if needed) and resolves the Expo push token, or null if
 * push notifications are unavailable (e.g. unsupported emulator) or denied.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    // Push tokens can only be issued to physical devices.
    console.warn('Push notifications are unavailable on this device/simulator.');
    return null;
  }

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
  } catch (e) {
    console.warn('Failed to obtain Expo push token:', e);
    return null;
  }
}

/**
 * Persists the device push token for the current user so the backend can target it.
 */
export async function savePushToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, token, platform: Platform.OS },
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