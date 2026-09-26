/**
 * healthMapping.js — turns Apple Health reads into the sync payload.
 *
 * Pure functions with no React Native or HealthKit imports, so they run (and
 * are unit-tested) anywhere. appleHealth.ios.js does the native reads and hands
 * plain objects in; everything that decides WHAT a number means lives here.
 *
 * Day boundaries are the member's LOCAL calendar days — the phone's timezone —
 * because that is what "today" means on every screen. The server stores the
 * date string it is given and never re-derives it.
 */

// HKCategoryValueSleepAnalysis
export const SLEEP = { inBed: 0, unspecified: 1, awake: 2, core: 3, deep: 4, rem: 5 };
const ASLEEP_VALUES = new Set([SLEEP.unspecified, SLEEP.core, SLEEP.deep, SLEEP.rem]);
const STAGE_KEY = {
  [SLEEP.inBed]: 'inBed',
  [SLEEP.unspecified]: 'unspecified',
  [SLEEP.awake]: 'awake',
  [SLEEP.core]: 'core',
  [SLEEP.deep]: 'deep',
  [SLEEP.rem]: 'rem',
};

// HKWorkoutActivityType → the label members see in history. Anything not listed
// falls back to "Workout" rather than an enum name.
const ACTIVITY_LABELS = {
  8: 'Boxing',
  11: 'Cross Training',
  13: 'Cycling',
  14: 'Dance',
  15: 'Dance Training',
  16: 'Elliptical',
  20: 'Functional Strength',
  24: 'Hiking',
  28: 'Martial Arts',
  30: 'Mixed Cardio',
  35: 'Rowing',
  37: 'Running',
  44: 'Stair Climbing',
  46: 'Swimming',
  50: 'Strength Training',
  52: 'Walking',
  57: 'Yoga',
  59: 'Core Training',
  62: 'Flexibility',
  63: 'HIIT',
  65: 'Kickboxing',
  66: 'Pilates',
  68: 'Stairs',
  69: 'Step Training',
  73: 'Mixed Cardio',
  80: 'Cooldown',
  3000: 'Workout',
};

export const activityLabel = (type) => ACTIVITY_LABELS[Number(type)] || 'Workout';

const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' for a Date in the device's local timezone. */
export function localDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight at the start of `date`'s day. */
export function startOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

const round1 = (n) => Math.round(n * 10) / 10;
const finite = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : null);

/**
 * One HealthKit statistics-collection result → { date, value } using `pick`.
 * Results come one per local day that actually has data, each starting at local
 * midnight because the query is anchored there.
 */
export function statsByDay(results, pick) {
  const out = new Map();
  for (const r of results || []) {
    if (!r?.startDate) continue;
    const v = finite(pick(r));
    if (v == null) continue;
    out.set(localDateKey(r.startDate), v);
  }
  return out;
}

export const pickSum = (r) => r?.sumQuantity?.quantity;
export const pickAvg = (r) => r?.averageQuantity?.quantity;
export const pickMin = (r) => r?.minimumQuantity?.quantity;
export const pickMax = (r) => r?.maximumQuantity?.quantity;

/** Total minutes covered by a set of [start, end] ms intervals, overlaps counted once. */
export function unionMinutes(intervals) {
  const sorted = intervals
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curS = null;
  let curE = null;
  for (const [s, e] of sorted) {
    if (curE == null || s > curE) {
      if (curE != null) total += curE - curS;
      curS = s;
      curE = e;
    } else if (e > curE) {
      curE = e;
    }
  }
  if (curE != null) total += curE - curS;
  return total / 60000;
}

/**
 * The "sleep day" a sample belongs to: the local date of the morning you wake
 * up. Shifting by +6h makes the day run 6 PM → 6 PM, so a 23:00–07:00 night
 * lands on the 07:00 day and an afternoon nap lands on its own day.
 */
export function sleepDayKey(endDate) {
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  return localDateKey(new Date(end.getTime() + 6 * 3600000));
}

const isWatch = (s) => typeof s.productType === 'string' && s.productType.startsWith('Watch');

/**
 * Sleep samples → per-night { sleepMinutes, sleepStages }.
 *
 * Several sources can describe the same night (Apple Watch, the iPhone, a
 * third-party sleep app), and adding them up would double-count. Each night
 * uses ONE source: an Apple Watch if one recorded that night, otherwise the
 * source with the most time asleep. Within that source, time asleep is the
 * union of asleep intervals, so overlapping samples still count once.
 * Time "in bed" is reported as a stage but never counted as sleep.
 */
export function summarizeSleep(samples) {
  const byNight = new Map();
  for (const s of samples || []) {
    if (!s?.startDate || !s?.endDate || !(s.value in STAGE_KEY)) continue;
    const start = new Date(s.startDate).getTime();
    const end = new Date(s.endDate).getTime();
    if (!(end > start)) continue;
    const key = sleepDayKey(s.endDate);
    if (!byNight.has(key)) byNight.set(key, []);
    byNight.get(key).push({ ...s, start, end });
  }

  const nights = new Map();
  for (const [night, list] of byNight) {
    const bySource = new Map();
    for (const s of list) {
      const src = s.bundleId || s.sourceName || 'unknown';
      if (!bySource.has(src)) bySource.set(src, []);
      bySource.get(src).push(s);
    }

    const asleepOf = (arr) => unionMinutes(arr.filter((x) => ASLEEP_VALUES.has(x.value)).map((x) => [x.start, x.end]));
    const candidates = [...bySource.values()];
    const watch = candidates.filter((arr) => arr.some(isWatch));
    const pool = watch.length ? watch : candidates;
    const chosen = pool.reduce((best, arr) => (asleepOf(arr) > asleepOf(best) ? arr : best), pool[0]);

    const stages = {};
    for (const [value, key] of Object.entries(STAGE_KEY)) {
      const mins = unionMinutes(chosen.filter((x) => x.value === Number(value)).map((x) => [x.start, x.end]));
      if (mins > 0) stages[key] = round1(mins);
    }
    const asleep = asleepOf(chosen);

    nights.set(night, {
      sleepMinutes: asleep > 0 ? round1(Math.min(asleep, 1440)) : null,
      sleepStages: Object.keys(stages).length ? stages : null,
    });
  }
  return nights;
}

/**
 * Merge the per-type maps into one row per local day. Days with no data at all
 * are omitted — the server treats a missing day as "nothing recorded".
 */
export function buildDays({ energy, hrAvg, hrMin, hrMax, resting, hrv, sleep }) {
  const keys = new Set();
  for (const m of [energy, hrAvg, hrMin, hrMax, resting, hrv, sleep]) {
    if (m) for (const k of m.keys()) keys.add(k);
  }

  const get = (m, k) => (m && m.has(k) ? round1(m.get(k)) : null);
  return [...keys].sort().map((date) => {
    const night = sleep?.get(date);
    return {
      date,
      activeCalories: get(energy, date),
      avgHeartRate: get(hrAvg, date),
      minHeartRate: get(hrMin, date),
      maxHeartRate: get(hrMax, date),
      restingHeartRate: get(resting, date),
      hrvMs: get(hrv, date),
      sleepMinutes: night?.sleepMinutes ?? null,
      sleepStages: night?.sleepStages ?? null,
    };
  });
}

// HealthKit unit strings are case-sensitive: 'Cal' is the large (food) calorie,
// i.e. a kilocalorie, while 'cal' is the small calorie.
const KCAL_PER_UNIT = { kcal: 1, Cal: 1, cal: 1 / 1000, kJ: 1 / 4.184, J: 1 / 4184 };

/** Energy quantity → kcal, whatever unit HealthKit handed back; null if unknown. */
export function toKcal(q) {
  if (!q || !Number.isFinite(q.quantity)) return null;
  const factor = KCAL_PER_UNIT[q.unit];
  return factor == null ? null : q.quantity * factor;
}

/**
 * A workout read from HealthKit → the sync payload shape.
 * `ownBundleId` skips anything this app wrote itself (read-only today, but it
 * keeps a future write-back from echoing gym sessions back as "Watch" workouts).
 */
export function mapWorkout(w, { ownBundleId } = {}) {
  if (!w?.uuid || !w.startDate || !w.endDate) return null;
  if (ownBundleId && w.bundleId === ownBundleId) return null;
  const start = new Date(w.startDate);
  const end = new Date(w.endDate);
  if (!(end > start)) return null;
  const calories = finite(w.calories);
  const hr = finite(w.avgHeartRate);
  return {
    externalId: String(w.uuid),
    workoutDate: localDateKey(start),
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    activityType: w.activityType != null ? String(w.activityType) : null,
    activityLabel: activityLabel(w.activityType),
    calories: calories != null ? round1(calories) : null,
    avgHeartRate: hr != null ? round1(hr) : null,
    sourceName: w.sourceName || null,
  };
}

export const BACKFILL_DAYS = 30;
export const OVERLAP_DAYS = 2;

/**
 * Where a sync should start reading: always a LOCAL MIDNIGHT.
 *   - first sync: BACKFILL_DAYS ago;
 *   - later syncs: OVERLAP_DAYS before the day of the last sync, because the
 *     Watch hands data to the phone late (sleep, HRV) and those days must be
 *     recomputed in full — never earlier than the backfill floor.
 */
export function syncWindowStart(lastSyncedAt, now = new Date()) {
  const floor = startOfLocalDay(now);
  floor.setDate(floor.getDate() - BACKFILL_DAYS);
  if (!lastSyncedAt) return floor;

  const last = new Date(lastSyncedAt);
  if (Number.isNaN(last.getTime()) || last > now) return floor;
  const from = startOfLocalDay(last);
  from.setDate(from.getDate() - OVERLAP_DAYS);
  return from < floor ? floor : from;
}

/**
 * Raw HealthKit reads → the POST /wearables/apple/sync body.
 * Only days and workouts on or after `anchorKey` are sent: anything earlier is
 * partial (e.g. a night that began before the window) and would overwrite a
 * complete day on the server.
 */
export function buildSyncPayload(raw, anchorKey, { ownBundleId } = {}) {
  const days = buildDays({
    energy: statsByDay(raw?.energy, pickSum),
    hrAvg: statsByDay(raw?.heartRate, pickAvg),
    hrMin: statsByDay(raw?.heartRate, pickMin),
    hrMax: statsByDay(raw?.heartRate, pickMax),
    resting: statsByDay(raw?.resting, pickAvg),
    hrv: statsByDay(raw?.hrv, pickAvg),
    sleep: summarizeSleep(raw?.sleep),
  }).filter((d) => d.date >= anchorKey);

  const workouts = (raw?.workouts || [])
    .map((w) => mapWorkout(w, { ownBundleId }))
    .filter((w) => w && w.workoutDate >= anchorKey);

  return { days, workouts };
}
