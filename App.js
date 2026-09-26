import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { useFonts } from 'expo-font';
import AppNavigator from './src/navigation/AppNavigator';
import UpdateGate from './src/components/UpdateGate';
import { FONT_ASSETS } from './src/theme';
import {
  FCM_TOKEN_KEY,
  ensureAndroidChannel,
  registerForPushNotificationsAsync,
  saveFCMToken,
  setupNotificationListeners,
  handleNotificationData,
  storeColdStartData,
  getNotificationPermission,
  requestNotificationPermission,
} from './src/services/notificationService';
import { useAuthStore } from './src/store/authStore';
import { useAnnouncementStore } from './src/store/announcementStore';
import { GuideProvider, GuideOverlay, useGuideStore } from './src/guide';

export default function App() {
  const [fontsLoaded] = useFonts(FONT_ASSETS);

  useEffect(() => {
    // The Android channel is defined once, in notificationService — Android
    // freezes a channel's importance at creation, so a second definition here
    // used to race the first one on fresh installs.
    ensureAndroidChannel();

    let cleanupNotifications;
    let appStateSubscription;

    const initializeApp = async () => {
      // ── 1. Bootstrap unread count (only when authenticated) ───────────────
      // Note: initialize() is called in AppNavigator on mount — no need here.
      const { isAuthenticated } = useAuthStore.getState();
      if (isAuthenticated) {
        useAnnouncementStore.getState().refreshUnreadCount().catch(() => {});
        // Guide switches are read here and on every foreground, so one turned
        // off on the server stops running without an app release.
        useGuideStore.getState().load().catch(() => {});
      }

      // ── 2. Ask for notification permission on launch (once) ──────────────
      // Fire the system dialog on first launch, like most apps. If the user
      // denies (or has already), the in-app NotificationPermissionBanner takes
      // over as the text fallback. requestNotificationPermission only shows the
      // OS dialog while canAskAgain is true; otherwise it's a no-op.
      try {
        const perm = await getNotificationPermission();
        if (!perm.granted && perm.canAskAgain) {
          await requestNotificationPermission();
        }
      } catch (err) {
        console.warn('launch notification permission prompt failed:', err?.message);
      }

      // ── 3. Register & sync FCM device token ──────────────────────────────
      try {
        const fcmToken = await registerForPushNotificationsAsync();

        if (fcmToken) {
          // Always upsert, never skip on an unchanged token. The row can be gone
          // or deactivated server-side (stale-token pruning, the legacy device_id
          // cleanup) while the token itself is unchanged — the old "skip if same"
          // shortcut meant such a device never re-registered. The call is a cheap
          // upsert and also refreshes last_seen_at, which gym occupancy reads.
          const { user } = useAuthStore.getState();
          await saveFCMToken(fcmToken, null, user?.id ?? null);
          await AsyncStorage.setItem(FCM_TOKEN_KEY, fcmToken);
        }

        cleanupNotifications = setupNotificationListeners({
          getUserId: () => useAuthStore.getState().user?.id ?? null,
        });
      } catch (error) {
        console.error('Error initializing notifications:', error);
      }

      // ── 4. Deep link: app opened from a killed state via notification ─────
      // Store the data — do NOT navigate yet. SplashScreen fires it after
      // navigation.replace('MainTabs') so the 3200ms Splash timer can't
      // override the deeplink navigation.
      try {
        const initialMessage = await messaging().getInitialNotification();
        if (initialMessage?.data) {
          storeColdStartData(initialMessage.data);
        }
      } catch (err) {
        console.warn('getInitialNotification error:', err);
      }

      // ── 5. Deep link: app in background, user taps notification ──────────
      const unsubscribeOnOpen = messaging().onNotificationOpenedApp((remoteMessage) => {
        if (remoteMessage?.data) {
          handleNotificationData(remoteMessage.data);
        }
      });

      // ── 6. Refresh unread count when app comes back to foreground ─────────
      appStateSubscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          const { isAuthenticated: authed } = useAuthStore.getState();
          if (authed) {
            useAnnouncementStore.getState().refreshUnreadCount().catch(() => {});
            useGuideStore.getState().load().catch(() => {});
          }
        }
      });

      // Return combined cleanup
      const origCleanup = cleanupNotifications;
      cleanupNotifications = () => {
        if (origCleanup) origCleanup();
        unsubscribeOnOpen();
      };
    };

    // Small delay so the JS bridge is ready
    const timer = setTimeout(() => { initializeApp(); }, 100);

    return () => {
      clearTimeout(timer);
      if (cleanupNotifications) cleanupNotifications();
      if (appStateSubscription) appStateSubscription.remove();
    };
  }, []);

  // Hold rendering until the brand fonts are ready so the UI never flashes
  // with the system fallback. The native splash stays up in the meantime.
  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* The guide overlay sits above the navigator so one instance can dim
            and cut out any screen. UpdateGate stays last: a forced update must
            cover a running guide, not the other way round. */}
        <GuideProvider>
          <AppNavigator />
          <GuideOverlay />
        </GuideProvider>
        <UpdateGate />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}