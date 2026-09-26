/**
 * appleHealth.ios.js — the ONLY file that touches HealthKit.
 *
 * Metro picks this file on iOS and `appleHealth.js` everywhere else, so the
 * HealthKit library is never bundled into the Android app at all.
 *
 * Read-only by design (v1): nothing here writes to Apple Health.
 *
 * Every read goes through Promise.allSettled — a failure in one data type (a
 * type the member switched off, an old iOS without a statistic) must not cost
 * the member the other five. Each outcome is reported back for diagnostics.
 *
 * Note on permissions: iOS never tells an app which READ types the member
 * allowed. A denied type simply returns no data. That is why the Devices screen
 * explains where to change it instead of claiming a permission state.
 */
import {
  AuthorizationRequestStatus,
  getRequestStatusForAuthorization,
  isHealthDataAvailableAsync,
  queryCategorySamples,
  queryStatisticsCollectionForQuantity,
  queryWorkoutSamples,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { toKcal } from './healthMapping';

export const READ_TYPES = [
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKWorkoutTypeIdentifier',
];

const MAX_WORKOUTS = 200;
const WORKOUT_STAT_CONCURRENCY = 8;

export async function isAvailable() {
  try {
    return await isHealthDataAvailableAsync();
  } catch {
    return false;
  }
}

/** True when iOS would still show the permission sheet for our read types. */
export async function needsPermissionPrompt() {
  try {
    const status = await getRequestStatusForAuthorization({ toRead: READ_TYPES });
    return status === AuthorizationRequestStatus.shouldRequest;
  } catch {
    return true;
  }
}

/**
 * Shows the iOS Health permission sheet — only the first time. After that iOS
 * resolves immediately without UI, whatever the member chose.
 */
export async function requestPermission() {
  return requestAuthorization({ toRead: READ_TYPES });
}

const quantityOf = (q) => (q && Number.isFinite(q.quantity) ? q.quantity : null);

async function readWorkout(w) {
  // Per-workout statistics exist from iOS 16; fall back to the (older)
  // totalEnergyBurned field when they are not available.
  let avgHeartRate = null;
  let calories = null;
  try {
    const hr = await w.getStatistic('HKQuantityTypeIdentifierHeartRate', 'count/min');
    avgHeartRate = quantityOf(hr?.averageQuantity);
  } catch { /* no HR recorded for this workout */ }
  try {
    const kcal = await w.getStatistic('HKQuantityTypeIdentifierActiveEnergyBurned', 'kcal');
    calories = quantityOf(kcal?.sumQuantity);
  } catch { /* fall through to totalEnergyBurned */ }
  if (calories == null) calories = toKcal(w.totalEnergyBurned);

  return {
    uuid: w.uuid,
    startDate: w.startDate,
    endDate: w.endDate,
    activityType: w.workoutActivityType,
    calories,
    avgHeartRate,
    sourceName: w.sourceRevision?.source?.name ?? null,
    bundleId: w.sourceRevision?.source?.bundleIdentifier ?? null,
  };
}

async function mapLimited(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return out;
}

/**
 * Read everything for [anchor, end]. `anchor` MUST be a local midnight: the
 * server replaces whole days, so a window starting mid-day would overwrite a
 * complete day with a partial one.
 *
 * @returns {{ raw: object, outcomes: Record<string, {ok: boolean, count?: number, error?: string}> }}
 */
export async function readWindow(anchor, end) {
  const dateFilter = { date: { startDate: anchor, endDate: end } };
  const daily = (identifier, stats, unit) => queryStatisticsCollectionForQuantity(
    identifier, stats, anchor, { day: 1 }, { filter: dateFilter, unit },
  );

  // A night that ends on the first day of the window started the evening
  // before, so sleep is read from 18h earlier. healthMapping keys each night by
  // the morning it ends on; the caller drops nights before the window.
  const sleepFrom = new Date(anchor.getTime() - 18 * 3600000);

  const tasks = {
    energy: () => daily('HKQuantityTypeIdentifierActiveEnergyBurned', ['cumulativeSum'], 'kcal'),
    heartRate: () => daily('HKQuantityTypeIdentifierHeartRate', ['discreteAverage', 'discreteMin', 'discreteMax'], 'count/min'),
    resting: () => daily('HKQuantityTypeIdentifierRestingHeartRate', ['discreteAverage'], 'count/min'),
    hrv: () => daily('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', ['discreteAverage'], 'ms'),
    sleep: async () => {
      const samples = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
        limit: 0,
        ascending: true,
        filter: { date: { startDate: sleepFrom, endDate: end } },
      });
      return samples.map((s) => ({
        startDate: s.startDate,
        endDate: s.endDate,
        value: s.value,
        sourceName: s.sourceRevision?.source?.name ?? null,
        bundleId: s.sourceRevision?.source?.bundleIdentifier ?? null,
        productType: s.sourceRevision?.productType ?? null,
      }));
    },
    workouts: async () => {
      const found = await queryWorkoutSamples({ limit: MAX_WORKOUTS, ascending: false, filter: dateFilter });
      return mapLimited(found, WORKOUT_STAT_CONCURRENCY, readWorkout);
    },
  };

  const keys = Object.keys(tasks);
  const settled = await Promise.allSettled(keys.map((k) => tasks[k]()));

  const raw = {};
  const outcomes = {};
  settled.forEach((r, i) => {
    const k = keys[i];
    if (r.status === 'fulfilled') {
      raw[k] = r.value || [];
      outcomes[k] = { ok: true, count: raw[k].length };
    } else {
      raw[k] = [];
      outcomes[k] = { ok: false, error: String(r.reason?.message || r.reason).slice(0, 200) };
    }
  });
  return { raw, outcomes };
}
