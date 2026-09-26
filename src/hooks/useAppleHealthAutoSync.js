/**
 * useAppleHealthAutoSync — keeps Apple Health data fresh without a button.
 *
 * Apple never lets a server pull HealthKit data: it only reaches the backend
 * when the app is open. So every time the app comes to the foreground (and
 * once at launch) a signed-in iOS member with an active Apple connection gets
 * a sync — throttled, because the Watch hands data to the phone in batches and
 * re-reading every few seconds would only burn battery.
 *
 * Background delivery (syncing while the app is closed) is intentionally not in
 * v1; it needs an extra entitlement and its own TestFlight round.
 *
 * Mounted once in App.js. A no-op on Android and for signed-out users.
 */
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuthStore } from '../store/authStore';
import { fetchWearableConnections } from '../services/wearableService';
import * as AppleHealth from '../services/wearables/appleHealth';
import { runAppleSync } from '../services/wearables/appleSync';

const MIN_INTERVAL_MS = 15 * 60 * 1000;

export default function useAppleHealthAutoSync() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.user?.role);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !isAuthenticated || role !== 'member') return undefined;

    let lastAttempt = 0;
    let alive = true;

    const attempt = async () => {
      if (Date.now() - lastAttempt < MIN_INTERVAL_MS) return;
      lastAttempt = Date.now();
      try {
        const connections = await fetchWearableConnections();
        const apple = connections.find((c) => c.provider === 'apple' && c.status === 'connected');
        if (!alive || !apple) return;
        if (!(await AppleHealth.isAvailable())) return;
        await runAppleSync({ lastSyncedAt: apple.lastSyncedAt, reason: 'foreground' });
      } catch {
        // Silent by design — the Devices screen shows the last sync result.
      }
    };

    attempt();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') attempt();
    });

    return () => {
      alive = false;
      sub.remove();
    };
  }, [isAuthenticated, role]);
}
