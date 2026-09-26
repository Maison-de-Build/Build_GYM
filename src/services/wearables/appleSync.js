/**
 * appleSync.js — one Apple Health sync: read the window from HealthKit, map it,
 * push it to the backend, and record what happened.
 *
 * Diagnostics are the point of the second half. The only iPhone in this
 * project is a tester's, reached through TestFlight — there is no debugger and
 * no Metro log. Every sync (success or failure) saves a report the tester can
 * copy from the Devices screen and paste into a chat.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';

import * as AppleHealth from './appleHealth';
import { buildSyncPayload, localDateKey, syncWindowStart } from './healthMapping';
import { syncAppleHealth } from '../wearableService';

const DIAG_KEY = 'wearables.apple.lastDiagnostics';
const OWN_BUNDLE_ID = 'com.buildgym.app';

let inFlight = null;

function describeError(err) {
  const status = err?.response?.status;
  const serverMsg = err?.response?.data?.message;
  const code = err?.response?.data?.code;
  if (status) return `HTTP ${status}${code ? ` ${code}` : ''}${serverMsg ? ` — ${serverMsg}` : ''}`;
  return String(err?.message || err).slice(0, 300);
}

async function saveDiagnostics(diag) {
  try {
    await AsyncStorage.setItem(DIAG_KEY, JSON.stringify(diag));
  } catch { /* diagnostics are best-effort */ }
}

export async function getLastDiagnostics() {
  try {
    const raw = await AsyncStorage.getItem(DIAG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearDiagnostics() {
  try { await AsyncStorage.removeItem(DIAG_KEY); } catch { /* ignore */ }
}

/** Plain-text report for the clipboard. */
export function formatDiagnostics(diag) {
  if (!diag) return 'No Apple Health sync has run on this device yet.';
  const lines = [
    `Maison de Build — Apple Health sync report`,
    `Result: ${diag.ok ? 'OK' : 'FAILED'}${diag.error ? ` (${diag.error})` : ''}`,
    `When: ${diag.startedAt} (${diag.durationMs ?? '?'} ms, trigger: ${diag.reason})`,
    `Window: ${diag.window?.from} → ${diag.window?.to}`,
    `App: ${diag.appVersion} (${diag.build}) · iOS ${diag.osVersion}`,
  ];
  if (diag.reads) {
    lines.push('HealthKit reads:');
    for (const [k, v] of Object.entries(diag.reads)) {
      lines.push(`  ${k}: ${v.ok ? `${v.count} result(s)` : `ERROR ${v.error}`}`);
    }
  }
  if (diag.prepared) lines.push(`Prepared: ${diag.prepared.days} day(s), ${diag.prepared.workouts} workout(s)`);
  if (diag.server) {
    const s = diag.server;
    lines.push(`Server: accepted ${s.acceptedDays} day(s) / ${s.acceptedWorkouts} workout(s), rejected ${s.rejectedDays} / ${s.rejectedWorkouts}`);
    if (s.rejectedDays || s.rejectedWorkouts) lines.push(`Rejections: ${JSON.stringify(s.rejected)}`);
  }
  return lines.join('\n');
}

async function doSync({ lastSyncedAt, reason }) {
  const startedMs = Date.now();
  const now = new Date();
  const anchor = syncWindowStart(lastSyncedAt, now);

  const diag = {
    ok: false,
    reason,
    startedAt: now.toISOString(),
    window: { from: localDateKey(anchor), to: localDateKey(now) },
    appVersion: Application.nativeApplicationVersion,
    build: Application.nativeBuildVersion,
    osVersion: String(Platform.Version),
  };

  try {
    const { raw, outcomes } = await AppleHealth.readWindow(anchor, now);
    diag.reads = outcomes;

    const payload = buildSyncPayload(raw, diag.window.from, {
      ownBundleId: Application.applicationId || OWN_BUNDLE_ID,
    });
    diag.prepared = { days: payload.days.length, workouts: payload.workouts.length };

    const result = await syncAppleHealth({
      ...payload,
      client: { appVersion: diag.appVersion, osVersion: diag.osVersion },
    });
    diag.server = result;
    diag.ok = true;
    return { ok: true, result, diag };
  } catch (err) {
    diag.error = describeError(err);
    return { ok: false, code: err?.response?.data?.code || null, error: diag.error, diag };
  } finally {
    diag.durationMs = Date.now() - startedMs;
    await saveDiagnostics(diag);
  }
}

/**
 * Run a sync. Concurrent callers share the one in flight, so a foreground
 * auto-sync and a "Sync now" tap never race each other.
 *
 * @param {{ lastSyncedAt: string|null, reason: 'connect'|'manual'|'foreground' }} opts
 * @returns {Promise<{ ok: boolean, result?: object, error?: string, code?: string, diag: object }>}
 */
export function runAppleSync(opts) {
  if (!inFlight) {
    inFlight = doSync(opts).finally(() => { inFlight = null; });
  }
  return inFlight;
}

export const isSyncing = () => inFlight != null;
