import { describe, it, expect } from 'vitest';
import {
  SLEEP, localDateKey, startOfLocalDay, statsByDay, pickSum, pickAvg, pickMin, pickMax,
  unionMinutes, sleepDayKey, summarizeSleep, buildDays, toKcal, mapWorkout, activityLabel,
} from '../healthMapping';

// Local-time constructors keep every expectation valid in any timezone.
const at = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);

describe('local dates', () => {
  it('formats the local calendar date, not the UTC one', () => {
    expect(localDateKey(at(2026, 9, 25, 23, 59))).toBe('2026-09-25');
    expect(localDateKey(at(2026, 9, 26, 0, 1))).toBe('2026-09-26');
  });

  it('finds local midnight', () => {
    const d = startOfLocalDay(at(2026, 9, 25, 17, 42));
    expect([d.getHours(), d.getMinutes(), localDateKey(d)]).toEqual([0, 0, '2026-09-25']);
  });
});

describe('statsByDay', () => {
  const results = [
    { startDate: at(2026, 9, 24), sumQuantity: { quantity: 512.44, unit: 'kcal' } },
    { startDate: at(2026, 9, 25), sumQuantity: { quantity: 610, unit: 'kcal' }, averageQuantity: { quantity: 71, unit: 'count/min' } },
    { startDate: at(2026, 9, 26) }, // interval with no value for this statistic
    { sumQuantity: { quantity: 1 } }, // no date — ignored
  ];

  it('keys results by local day and skips empty statistics', () => {
    const m = statsByDay(results, pickSum);
    expect([...m.entries()]).toEqual([['2026-09-24', 512.44], ['2026-09-25', 610]]);
    expect([...statsByDay(results, pickAvg).keys()]).toEqual(['2026-09-25']);
  });

  it('exposes min / max pickers', () => {
    const r = { minimumQuantity: { quantity: 50 }, maximumQuantity: { quantity: 160 } };
    expect([pickMin(r), pickMax(r)]).toEqual([50, 160]);
  });

  it('tolerates a missing result list', () => {
    expect(statsByDay(undefined, pickSum).size).toBe(0);
  });
});

describe('unionMinutes', () => {
  it('counts overlapping intervals once', () => {
    const m = 60000;
    expect(unionMinutes([[0, 60 * m], [30 * m, 90 * m], [120 * m, 150 * m]])).toBe(120);
  });

  it('ignores zero-length and inverted intervals', () => {
    expect(unionMinutes([[10, 10], [50, 20]])).toBe(0);
  });
});

describe('sleep', () => {
  it('assigns a night to the morning you wake up, and a nap to its own day', () => {
    expect(sleepDayKey(at(2026, 9, 26, 7, 0))).toBe('2026-09-26');
    expect(sleepDayKey(at(2026, 9, 26, 15, 0))).toBe('2026-09-26');
    // Ends late evening → belongs to the night that finishes tomorrow morning.
    expect(sleepDayKey(at(2026, 9, 26, 23, 30))).toBe('2026-09-27');
  });

  const watch = (start, end, value) => ({
    startDate: start, endDate: end, value,
    sourceName: 'Apple Watch', bundleId: 'com.apple.health.WATCH', productType: 'Watch7,3',
  });
  const phone = (start, end, value) => ({
    startDate: start, endDate: end, value,
    sourceName: 'iPhone', bundleId: 'com.apple.health.PHONE', productType: 'iPhone15,2',
  });

  it('sums stages from the Watch and never counts time in bed as sleep', () => {
    const nights = summarizeSleep([
      phone(at(2026, 9, 25, 22, 30), at(2026, 9, 26, 7, 0), SLEEP.inBed), // phone: 8.5h in bed
      watch(at(2026, 9, 25, 23, 0), at(2026, 9, 26, 1, 0), SLEEP.core),
      watch(at(2026, 9, 26, 1, 0), at(2026, 9, 26, 2, 0), SLEEP.deep),
      watch(at(2026, 9, 26, 2, 0), at(2026, 9, 26, 2, 10), SLEEP.awake),
      watch(at(2026, 9, 26, 2, 10), at(2026, 9, 26, 3, 40), SLEEP.rem),
      watch(at(2026, 9, 26, 3, 40), at(2026, 9, 26, 6, 40), SLEEP.core),
    ]);
    const n = nights.get('2026-09-26');
    expect(n.sleepMinutes).toBe(450); // 120 + 60 + 90 + 180, awake excluded
    expect(n.sleepStages).toEqual({ core: 300, deep: 60, rem: 90, awake: 10 });
  });

  it('does not double-count two sources describing the same night', () => {
    const nights = summarizeSleep([
      phone(at(2026, 9, 25, 23, 0), at(2026, 9, 26, 7, 0), SLEEP.unspecified),
      watch(at(2026, 9, 25, 23, 30), at(2026, 9, 26, 6, 30), SLEEP.unspecified),
    ]);
    // The Watch wins even though the phone reports more time.
    expect(nights.get('2026-09-26').sleepMinutes).toBe(420);
  });

  it('without a Watch, uses the source with the most sleep', () => {
    const app = (s, e) => ({ startDate: s, endDate: e, value: SLEEP.unspecified, sourceName: 'SleepApp', bundleId: 'com.sleep.app' });
    const nights = summarizeSleep([
      phone(at(2026, 9, 25, 23, 0), at(2026, 9, 26, 5, 0), SLEEP.unspecified), // 6h
      app(at(2026, 9, 25, 23, 0), at(2026, 9, 26, 6, 30)),                    // 7.5h
    ]);
    expect(nights.get('2026-09-26').sleepMinutes).toBe(450);
  });

  it('merges overlapping samples from one source', () => {
    const nights = summarizeSleep([
      watch(at(2026, 9, 25, 23, 0), at(2026, 9, 26, 3, 0), SLEEP.core),
      watch(at(2026, 9, 26, 2, 0), at(2026, 9, 26, 6, 0), SLEEP.core),
    ]);
    expect(nights.get('2026-09-26').sleepMinutes).toBe(420);
  });

  it('reports in-bed-only nights with no sleep minutes', () => {
    const nights = summarizeSleep([phone(at(2026, 9, 25, 23, 0), at(2026, 9, 26, 7, 0), SLEEP.inBed)]);
    expect(nights.get('2026-09-26')).toEqual({ sleepMinutes: null, sleepStages: { inBed: 480 } });
  });

  it('skips malformed samples', () => {
    const nights = summarizeSleep([
      { startDate: at(2026, 9, 26, 1), endDate: at(2026, 9, 26, 1), value: SLEEP.core },
      { startDate: at(2026, 9, 26, 1), endDate: at(2026, 9, 26, 2), value: 99 },
      null,
    ]);
    expect(nights.size).toBe(0);
  });
});

describe('buildDays', () => {
  it('merges every metric into one row per day, sorted, with nulls for gaps', () => {
    const days = buildDays({
      energy: new Map([['2026-09-25', 610.04], ['2026-09-24', 512.44]]),
      hrAvg: new Map([['2026-09-25', 71.26]]),
      hrMin: new Map([['2026-09-25', 49]]),
      hrMax: new Map([['2026-09-25', 158]]),
      resting: new Map([['2026-09-25', 57]]),
      hrv: new Map([['2026-09-24', 42.36]]),
      sleep: new Map([['2026-09-25', { sleepMinutes: 432, sleepStages: { deep: 80 } }]]),
    });
    expect(days).toEqual([
      {
        date: '2026-09-24', activeCalories: 512.4, avgHeartRate: null, minHeartRate: null, maxHeartRate: null,
        restingHeartRate: null, hrvMs: 42.4, sleepMinutes: null, sleepStages: null,
      },
      {
        date: '2026-09-25', activeCalories: 610, avgHeartRate: 71.3, minHeartRate: 49, maxHeartRate: 158,
        restingHeartRate: 57, hrvMs: null, sleepMinutes: 432, sleepStages: { deep: 80 },
      },
    ]);
  });

  it('returns nothing when there is no data', () => {
    expect(buildDays({})).toEqual([]);
  });
});

describe('toKcal', () => {
  it('converts HealthKit energy units (case-sensitive)', () => {
    expect(toKcal({ quantity: 300, unit: 'kcal' })).toBe(300);
    expect(toKcal({ quantity: 300, unit: 'Cal' })).toBe(300);
    expect(toKcal({ quantity: 300000, unit: 'cal' })).toBe(300);
    expect(toKcal({ quantity: 4184, unit: 'kJ' })).toBeCloseTo(1000, 6);
    expect(toKcal({ quantity: 4184, unit: 'J' })).toBeCloseTo(1, 6);
  });

  it('returns null for an unknown unit or a missing quantity', () => {
    expect(toKcal({ quantity: 1, unit: 'lb' })).toBeNull();
    expect(toKcal(undefined)).toBeNull();
    expect(toKcal({ unit: 'kcal' })).toBeNull();
  });
});

describe('mapWorkout', () => {
  const w = {
    uuid: 'A1B2C3D4-0000-4000-8000-000000000001',
    startDate: at(2026, 9, 25, 23, 30),
    endDate: at(2026, 9, 26, 0, 20),
    activityType: 50,
    calories: 312.44,
    avgHeartRate: 128.26,
    sourceName: "Arjun's Apple Watch",
    bundleId: 'com.apple.health.WATCH',
  };

  it('dates a workout by the local day it STARTED on', () => {
    const m = mapWorkout(w);
    expect(m.workoutDate).toBe('2026-09-25');
    expect(m).toMatchObject({
      externalId: w.uuid, activityType: '50', activityLabel: 'Strength Training',
      calories: 312.4, avgHeartRate: 128.3, sourceName: "Arjun's Apple Watch",
    });
    expect(m.startedAt).toBe(w.startDate.toISOString());
  });

  it('skips workouts this app wrote itself', () => {
    expect(mapWorkout({ ...w, bundleId: 'com.buildgym.app' }, { ownBundleId: 'com.buildgym.app' })).toBeNull();
  });

  it('rejects missing ids and inverted times, and tolerates missing numbers', () => {
    expect(mapWorkout({ ...w, uuid: '' })).toBeNull();
    expect(mapWorkout({ ...w, endDate: w.startDate })).toBeNull();
    const m = mapWorkout({ ...w, calories: undefined, avgHeartRate: NaN, activityType: 9999 });
    expect([m.calories, m.avgHeartRate, m.activityLabel]).toEqual([null, null, 'Workout']);
  });

  it('labels common activity types', () => {
    expect(activityLabel(63)).toBe('HIIT');
    expect(activityLabel('37')).toBe('Running');
  });
});

import { syncWindowStart, buildSyncPayload, BACKFILL_DAYS } from '../healthMapping';

describe('syncWindowStart', () => {
  const now = at(2026, 9, 26, 14, 30);

  it('backfills 30 days on the first sync, from local midnight', () => {
    const s = syncWindowStart(null, now);
    expect(localDateKey(s)).toBe('2026-08-27');
    expect([s.getHours(), s.getMinutes()]).toEqual([0, 0]);
    expect(BACKFILL_DAYS).toBe(30);
  });

  it('re-reads two full days before the last sync', () => {
    const s = syncWindowStart(at(2026, 9, 25, 21, 5).toISOString(), now);
    expect(localDateKey(s)).toBe('2026-09-23');
    expect(s.getHours()).toBe(0);
  });

  it('never reaches past the backfill floor, and ignores bad or future timestamps', () => {
    expect(localDateKey(syncWindowStart(at(2026, 1, 1).toISOString(), now))).toBe('2026-08-27');
    expect(localDateKey(syncWindowStart('garbage', now))).toBe('2026-08-27');
    expect(localDateKey(syncWindowStart(at(2027, 1, 1).toISOString(), now))).toBe('2026-08-27');
  });
});

describe('buildSyncPayload', () => {
  it('drops days and workouts from before the window, and our own workouts', () => {
    const raw = {
      energy: [
        { startDate: at(2026, 9, 22), sumQuantity: { quantity: 100 } },
        { startDate: at(2026, 9, 23), sumQuantity: { quantity: 200 } },
      ],
      heartRate: [{ startDate: at(2026, 9, 23), averageQuantity: { quantity: 70 }, minimumQuantity: { quantity: 50 }, maximumQuantity: { quantity: 150 } }],
      resting: [], hrv: [],
      sleep: [{ startDate: at(2026, 9, 22, 23), endDate: at(2026, 9, 23, 6), value: SLEEP.core, bundleId: 'w', productType: 'Watch7,1' }],
      workouts: [
        { uuid: 'OLD-1', startDate: at(2026, 9, 22, 7), endDate: at(2026, 9, 22, 8), activityType: 37 },
        { uuid: 'NEW-1', startDate: at(2026, 9, 23, 7), endDate: at(2026, 9, 23, 8), activityType: 37 },
        { uuid: 'OWN-1', startDate: at(2026, 9, 23, 9), endDate: at(2026, 9, 23, 10), activityType: 50, bundleId: 'com.buildgym.app' },
      ],
    };
    const p = buildSyncPayload(raw, '2026-09-23', { ownBundleId: 'com.buildgym.app' });
    expect(p.days).toHaveLength(1);
    expect(p.days[0]).toMatchObject({ date: '2026-09-23', activeCalories: 200, avgHeartRate: 70, minHeartRate: 50, maxHeartRate: 150, sleepMinutes: 420 });
    expect(p.workouts.map((w) => w.externalId)).toEqual(['NEW-1']);
  });

  it('copes with a completely empty read', () => {
    expect(buildSyncPayload({}, '2026-09-23')).toEqual({ days: [], workouts: [] });
  });
});
