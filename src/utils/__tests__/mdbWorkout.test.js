import { describe, it, expect } from 'vitest';
import {
  isoDate, buildDayStrip, sequenceOf, targetLine, targetLoadKg,
  estimatedMinutes, totalSets, intensityLabel, focusLabel,
  initialsOf, titleCase, relativeDateTime,
  STRIP_BEFORE, STRIP_AFTER,
} from '../mdbWorkout.js';

/* ── isoDate ─────────────────────────────────────────────────────────────── */
describe('isoDate', () => {
  it('formats a local date, not a UTC one', () => {
    // Late-evening local times must not roll forward a day the way
    // toISOString() would in a positive-offset zone.
    expect(isoDate(new Date(2026, 8, 4, 23, 30))).toBe('2026-09-04');
    expect(isoDate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('zero-pads month and day', () => {
    expect(isoDate(new Date(2026, 2, 7))).toBe('2026-03-07');
  });
});

/* ── buildDayStrip ───────────────────────────────────────────────────────── */
describe('buildDayStrip', () => {
  const now = new Date(2026, 8, 6); // Sun 6 Sep 2026

  it('renders seven days with today in the pack’s position', () => {
    const days = buildDayStrip({}, now);
    expect(days).toHaveLength(STRIP_BEFORE + STRIP_AFTER + 1);
    expect(days).toHaveLength(7);
    expect(days[STRIP_BEFORE].isToday).toBe(true);
    expect(days[STRIP_BEFORE].iso).toBe('2026-09-06');
    // Four days of history, then today, then two upcoming.
    expect(days[0].iso).toBe('2026-09-02');
    expect(days[6].iso).toBe('2026-09-08');
  });

  it('labels weekdays and zero-pads the date', () => {
    const days = buildDayStrip({}, now);
    expect(days.map((d) => d.label)).toEqual(['WED', 'THU', 'FRI', 'SAT', 'SUN', 'MON', 'TUE']);
    expect(days[0].date).toBe('02');
  });

  it('marks a completed day with the tick status', () => {
    const days = buildDayStrip({
      history: [{ workoutDate: '2026-09-04', status: 'completed' }],
    }, now);
    expect(days.find((d) => d.iso === '2026-09-04').status).toBe('completed');
  });

  it('treats a partial workout as completed', () => {
    const days = buildDayStrip({
      history: [{ workoutDate: '2026-09-04', status: 'partial' }],
    }, now);
    expect(days.find((d) => d.iso === '2026-09-04').status).toBe('completed');
  });

  it('marks an assigned or in-progress day with the dot status', () => {
    const days = buildDayStrip({
      today: [{ workoutDate: '2026-09-06', status: 'in_progress' }],
      upcoming: [{ workoutDate: '2026-09-07', status: 'assigned' }],
    }, now);
    expect(days.find((d) => d.iso === '2026-09-06').status).toBe('assigned');
    expect(days.find((d) => d.iso === '2026-09-07').status).toBe('assigned');
  });

  it('prefers completed over assigned when a day holds both', () => {
    const days = buildDayStrip({
      today: [
        { workoutDate: '2026-09-06', status: 'assigned' },
        { workoutDate: '2026-09-06', status: 'completed' },
      ],
    }, now);
    expect(days.find((d) => d.iso === '2026-09-06').status).toBe('completed');
  });

  it('leaves rest days and missed workouts without an indicator', () => {
    const days = buildDayStrip({
      history: [{ workoutDate: '2026-09-03', status: 'missed' }],
    }, now);
    expect(days.find((d) => d.iso === '2026-09-05').status).toBeNull();
    expect(days.find((d) => d.iso === '2026-09-03').status).toBeNull();
  });

  it('attaches each day’s instances and ignores dates outside the window', () => {
    const days = buildDayStrip({
      today: [{ workoutDate: '2026-09-06', status: 'assigned', id: 'a' }],
      history: [{ workoutDate: '2026-07-01', status: 'completed', id: 'old' }],
    }, now);
    expect(days.find((d) => d.iso === '2026-09-06').instances).toHaveLength(1);
    expect(days.every((d) => d.instances.every((i) => i.id !== 'old'))).toBe(true);
  });

  it('survives an empty or absent payload', () => {
    expect(buildDayStrip(undefined, now)).toHaveLength(7);
    expect(buildDayStrip({}, now).every((d) => d.instances.length === 0)).toBe(true);
  });
});

/* ── sequenceOf ──────────────────────────────────────────────────────────── */
describe('sequenceOf', () => {
  it('orders by `order` and letters A, B, C…', () => {
    const seq = sequenceOf({
      snapshot: {
        exercises: [
          { exerciseId: '2', name: 'Second', order: 2, sets: 3, targetReps: 10 },
          { exerciseId: '1', name: 'First', order: 1, sets: 3, targetReps: 10 },
          { exerciseId: '3', name: 'Third', order: 3, sets: 3, targetReps: 10 },
        ],
      },
    });
    expect(seq.map((e) => e.letter)).toEqual(['A', 'B', 'C']);
    expect(seq.map((e) => e.name)).toEqual(['First', 'Second', 'Third']);
  });

  it('does not mutate the source array', () => {
    const exercises = [
      { exerciseId: '2', name: 'Second', order: 2 },
      { exerciseId: '1', name: 'First', order: 1 },
    ];
    sequenceOf({ snapshot: { exercises } });
    expect(exercises[0].name).toBe('Second');
  });

  it('returns an empty list for a workout with no snapshot', () => {
    expect(sequenceOf(null)).toEqual([]);
    expect(sequenceOf({})).toEqual([]);
  });
});

/* ── targetLine ──────────────────────────────────────────────────────────── */
describe('targetLine', () => {
  it('renders the pack’s weight+reps form', () => {
    expect(targetLine({ sets: 3, targetReps: 10, targetWeight: 22 })).toBe('3 × 10 @ 22 kg');
  });

  it('says Bodyweight for an unloaded bodyweight exercise', () => {
    expect(targetLine({ sets: 3, targetReps: 12, equipmentType: 'bodyweight' }))
      .toBe('3 × 12 @ Bodyweight');
  });

  it('says Weight TBD when a percentage could not be resolved', () => {
    expect(targetLine({ sets: 3, targetReps: 10, weightSource: 'uncalibrated' }))
      .toBe('3 × 10 @ Weight TBD');
  });

  it('leaves non-weight measurement types to the shared formatter', () => {
    expect(targetLine({ sets: 3, measurementType: 'time', targetTimeSeconds: 120 }))
      .toBe('3 × 02:00');
    expect(targetLine({ sets: 5, measurementType: 'distance', targetDistance: 2000 }))
      .toBe('5 × 2 km');
  });
});

/* ── targetLoadKg ────────────────────────────────────────────────────────── */
describe('targetLoadKg', () => {
  it('sums sets × reps × weight', () => {
    expect(targetLoadKg([
      { sets: 3, targetReps: 10, targetWeight: 22 }, // 660
      { sets: 4, targetReps: 8, targetWeight: 70 },  // 2240
    ])).toBe(2900);
  });

  it('skips exercises with no prescribed load rather than counting them as zero', () => {
    expect(targetLoadKg([
      { sets: 3, targetReps: 10, targetWeight: 20 }, // 600
      { sets: 3, targetReps: 12 },                   // bodyweight — excluded
    ])).toBe(600);
  });

  it('is null when nothing is loadable, so the UI can hide the line', () => {
    expect(targetLoadKg([{ sets: 3, targetReps: 12 }])).toBeNull();
    expect(targetLoadKg([])).toBeNull();
  });
});

/* ── estimatedMinutes / totalSets ────────────────────────────────────────── */
describe('estimatedMinutes', () => {
  it('accounts for rest plus working time per set', () => {
    // 3 sets × (90s rest + 45s work) = 405s ≈ 7 min
    expect(estimatedMinutes([{ sets: 3, restSeconds: 90 }])).toBe(7);
  });

  it('defaults missing sets and rest rather than returning NaN', () => {
    expect(estimatedMinutes([{}])).toBe(7); // 3 sets × 135s
  });

  it('is null for an empty sequence', () => {
    expect(estimatedMinutes([])).toBeNull();
  });
});

describe('totalSets', () => {
  it('adds prescribed sets across exercises', () => {
    expect(totalSets([{ sets: 3 }, { sets: 4 }, { targetSets: 2 }])).toBe(9);
  });

  it('is zero for an empty sequence', () => {
    expect(totalSets([])).toBe(0);
  });
});

/* ── intensityLabel ──────────────────────────────────────────────────────── */
describe('intensityLabel', () => {
  it('prefers the trainer’s own percentage prescription', () => {
    expect(intensityLabel([{ originalPercentage: 85 }, { originalPercentage: 90 }])).toBe('High');
    expect(intensityLabel([{ originalPercentage: 70 }, { originalPercentage: 72 }])).toBe('Moderate');
    expect(intensityLabel([{ originalPercentage: 55 }])).toBe('Low');
  });

  it('falls back to rep ranges when no percentage was prescribed', () => {
    expect(intensityLabel([{ targetReps: 5 }, { targetReps: 6 }])).toBe('High');
    expect(intensityLabel([{ targetReps: 10 }])).toBe('Moderate');
    expect(intensityLabel([{ targetReps: 20 }])).toBe('Low');
  });

  it('ignores a percentage of zero rather than reading it as a prescription', () => {
    expect(intensityLabel([{ originalPercentage: 0, targetReps: 5 }])).toBe('High');
  });

  it('is null when there is nothing to judge from', () => {
    expect(intensityLabel([])).toBeNull();
    expect(intensityLabel([{ measurementType: 'time' }])).toBeNull();
  });
});

/* ── focusLabel ──────────────────────────────────────────────────────────── */
describe('focusLabel', () => {
  it('uses the template’s activity target when present', () => {
    expect(focusLabel({ activityTarget: 'full_body' })).toBe('Full Body');
  });

  it('otherwise picks the most-represented primary muscle group', () => {
    expect(focusLabel({
      snapshot: {
        exercises: [
          { muscleGroupPrimary: 'chest' },
          { muscleGroupPrimary: 'chest' },
          { muscleGroupPrimary: 'triceps' },
        ],
      },
    })).toBe('Chest');
  });

  it('is null when neither source has anything', () => {
    expect(focusLabel({ snapshot: { exercises: [] } })).toBeNull();
    expect(focusLabel(null)).toBeNull();
  });
});

/* ── initialsOf / titleCase ──────────────────────────────────────────────── */
describe('initialsOf', () => {
  it('takes first and last initials', () => {
    expect(initialsOf('Kaito Tanaka')).toBe('KT');
    expect(initialsOf('Ana Maria Silva')).toBe('AS');
  });

  it('falls back to the first two letters of a single name', () => {
    expect(initialsOf('Kaito')).toBe('KA');
  });

  it('handles empty and whitespace-only input', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf('   ')).toBe('?');
    expect(initialsOf(null)).toBe('?');
  });
});

describe('titleCase', () => {
  it('replaces underscores and capitalises each word', () => {
    expect(titleCase('upper_back')).toBe('Upper Back');
    expect(titleCase('core')).toBe('Core');
  });

  it('returns an empty string for nullish input', () => {
    expect(titleCase(null)).toBe('');
  });
});

/* ── relativeDateTime ────────────────────────────────────────────────────── */
describe('relativeDateTime', () => {
  const now = new Date(2026, 8, 6, 12, 0);

  it('says Today and Yesterday', () => {
    expect(relativeDateTime(new Date(2026, 8, 6, 9, 0), now)).toMatch(/^Today, 09:00$/);
    expect(relativeDateTime(new Date(2026, 8, 5, 18, 30), now)).toMatch(/^Yesterday, 18:30$/);
  });

  it('falls back to a short date further back', () => {
    expect(relativeDateTime(new Date(2026, 7, 28, 7, 15), now)).toMatch(/^28 Aug, 07:15$/);
  });

  it('is null for missing or unparseable input', () => {
    expect(relativeDateTime(null, now)).toBeNull();
    expect(relativeDateTime('not a date', now)).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Calendar browsing — added when the month dropdown and day selection were
 * fixed. Regression guards for two shipped bugs:
 *   · the strip was hard-wired to today, so no other date was reachable
 *   · overlapping /member/instances buckets double-counted a day's workouts
 * ══════════════════════════════════════════════════════════════════════════ */

import {
  flattenInstances, groupInstancesByDate, parseIsoLocal, dayPermissions,
  monthBounds, monthGrid, monthTitle, shiftMonth,
} from '../mdbWorkout.js';

describe('flattenInstances', () => {
  it('merges every bucket the endpoint can return', () => {
    const out = flattenInstances({
      today: [{ id: 1 }], upcoming: [{ id: 2 }], history: [{ id: 3 }], range: [{ id: 4 }],
    });
    expect(out.map((r) => r.id).sort()).toEqual([1, 2, 3, 4]);
  });

  it('passes a flat array straight through', () => {
    expect(flattenInstances([{ id: 1 }])).toHaveLength(1);
  });

  it('tolerates null / empty input', () => {
    expect(flattenInstances(null)).toEqual([]);
    expect(flattenInstances({})).toEqual([]);
  });
});

describe('groupInstancesByDate', () => {
  it('de-duplicates a row that appears in more than one bucket', () => {
    // A workout completed today is returned in BOTH `today` and `history`, and
    // the month range repeats it again — without de-duping the day would show
    // the same session three times.
    const row = { id: 'w1', workoutDate: '2026-09-06', status: 'completed' };
    const byDate = groupInstancesByDate({ today: [row], history: [row], range: [row] });
    expect(byDate.get('2026-09-06')).toHaveLength(1);
  });

  it('keeps genuinely distinct workouts on the same day', () => {
    const byDate = groupInstancesByDate([
      { id: 'a', workoutDate: '2026-09-06' },
      { id: 'b', workoutDate: '2026-09-06' },
    ]);
    expect(byDate.get('2026-09-06')).toHaveLength(2);
  });

  it('trims a full timestamp down to the calendar date', () => {
    const byDate = groupInstancesByDate([{ id: 'a', workoutDate: '2026-09-06T00:00:00.000Z' }]);
    expect(byDate.has('2026-09-06')).toBe(true);
  });
});

describe('parseIsoLocal', () => {
  it('parses as a local date, not UTC', () => {
    // new Date('2026-09-04') is UTC midnight — in a negative-offset zone that is
    // 3 Sep locally, which would select the wrong calendar cell.
    const d = parseIsoLocal('2026-09-04');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(4);
  });
});

describe('buildDayStrip — anchored browsing', () => {
  const now = new Date(2026, 8, 6); // Sun 6 Sep

  it('centres on today when no anchor is given', () => {
    const days = buildDayStrip({}, now);
    expect(days[4].iso).toBe('2026-09-06');
    expect(days[4].isToday).toBe(true);
  });

  it('re-centres on the anchor when one is given', () => {
    const days = buildDayStrip({}, now, '2026-06-15');
    expect(days).toHaveLength(7);
    expect(days[4].iso).toBe('2026-06-15');
    expect(days[0].iso).toBe('2026-06-11');
    expect(days[6].iso).toBe('2026-06-17');
  });

  it('keeps isToday measured against the real clock, never the anchor', () => {
    // This is what protects the write rules: browsing to June must not make a
    // June day "today" and unlock logging on it.
    const days = buildDayStrip({}, now, '2026-06-15');
    expect(days.every((d) => d.isToday === false)).toBe(true);
  });

  it('flags past and future correctly around today', () => {
    const days = buildDayStrip({}, now);
    expect(days[0].isPast).toBe(true);
    expect(days[4].isPast).toBe(false);
    expect(days[4].isFuture).toBe(false);
    expect(days[6].isFuture).toBe(true);
  });

  it('picks up workouts supplied by a month-range fetch', () => {
    const days = buildDayStrip(
      { range: [{ id: 'x', workoutDate: '2026-06-15', status: 'completed' }] },
      now,
      '2026-06-15',
    );
    expect(days[4].status).toBe('completed');
    expect(days[4].instances).toHaveLength(1);
  });

  it('handles an anchor that crosses a month boundary', () => {
    const days = buildDayStrip({}, now, '2026-03-02');
    expect(days[0].iso).toBe('2026-02-26');
    expect(days[6].iso).toBe('2026-03-04');
  });
});

describe('dayPermissions', () => {
  it('allows logging only on today', () => {
    expect(dayPermissions({ isToday: true }).canLog).toBe(true);
    expect(dayPermissions({ isPast: true }).canLog).toBe(false);
    expect(dayPermissions({ isFuture: true }).canLog).toBe(false);
  });

  it('allows scheduling today and in the future, never in the past', () => {
    // Mirrors the backend: self-assign accepts today..+14 only.
    expect(dayPermissions({ isToday: true }).canSchedule).toBe(true);
    expect(dayPermissions({ isFuture: true }).canSchedule).toBe(true);
    expect(dayPermissions({ isPast: true }).canSchedule).toBe(false);
  });

  it('states a reason for every locked day and none for today', () => {
    expect(dayPermissions({ isToday: true }).reason).toBeNull();
    expect(dayPermissions({ isPast: true }).reason).toMatch(/view only/i);
    expect(dayPermissions({ isFuture: true }).reason).toMatch(/scheduled/i);
  });

  it('locks everything when there is no day at all', () => {
    expect(dayPermissions(null)).toEqual({ canLog: false, canSchedule: false, reason: null });
  });
});

describe('monthBounds', () => {
  it('spans the whole month', () => {
    expect(monthBounds('2026-09-15')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(monthBounds('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('handles a leap February', () => {
    expect(monthBounds('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('monthGrid', () => {
  const now = new Date(2026, 8, 6);

  it('lays the month out in Monday-first weeks of exactly 7 cells', () => {
    const weeks = monthGrid('2026-09-01', new Map(), now);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    // 1 Sep 2026 is a Tuesday → one leading blank.
    expect(weeks[0][0]).toBeNull();
    expect(weeks[0][1].day).toBe(1);
  });

  it('includes every day of the month exactly once', () => {
    const days = monthGrid('2026-09-01', new Map(), now).flat().filter(Boolean).map((c) => c.day);
    expect(days).toHaveLength(30);
    expect(new Set(days).size).toBe(30);
  });

  it('marks today, past days and workout status', () => {
    const byDate = groupInstancesByDate([
      { id: 'a', workoutDate: '2026-09-04', status: 'completed' },
      { id: 'b', workoutDate: '2026-09-08', status: 'assigned' },
    ]);
    const cells = monthGrid('2026-09-01', byDate, now).flat().filter(Boolean);
    expect(cells.find((c) => c.day === 6).isToday).toBe(true);
    expect(cells.find((c) => c.day === 4).isPast).toBe(true);
    expect(cells.find((c) => c.day === 4).status).toBe('completed');
    expect(cells.find((c) => c.day === 8).status).toBe('assigned');
    expect(cells.find((c) => c.day === 9).status).toBeNull();
  });

  it('starts a Monday month with no leading blanks', () => {
    // 1 Jun 2026 is a Monday.
    expect(monthGrid('2026-06-01', new Map(), now)[0][0].day).toBe(1);
  });
});

describe('shiftMonth', () => {
  it('steps forward and back', () => {
    expect(shiftMonth('2026-09-15', 1)).toBe('2026-10-15');
    expect(shiftMonth('2026-09-15', -1)).toBe('2026-08-15');
  });

  it('crosses the year boundary', () => {
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-15');
    expect(shiftMonth('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('clamps a day that does not exist in the target month', () => {
    // 31 Jan −1 month must not roll into March.
    expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftMonth('2028-01-31', 1)).toBe('2028-02-29');
    expect(shiftMonth('2026-03-31', -1)).toBe('2026-02-28');
  });
});

describe('monthTitle', () => {
  it('renders month and year', () => {
    expect(monthTitle('2026-09-06')).toBe('September 2026');
    expect(monthTitle('2026-01-01')).toBe('January 2026');
  });
});

describe('targetLine — weight formatting', () => {
  it('drops the decimals a numeric column adds', () => {
    // Snapshot weights arrive as "40.00"; the pack shows "@ 40 kg".
    expect(targetLine({ sets: 3, targetReps: 8, targetWeight: '40.00' })).toBe('3 × 8 @ 40 kg');
    expect(targetLine({ sets: 3, targetReps: 8, targetWeight: 40 })).toBe('3 × 8 @ 40 kg');
  });

  it('keeps a genuine half-plate', () => {
    expect(targetLine({ sets: 3, targetReps: 8, targetWeight: '62.50' })).toBe('3 × 8 @ 62.5 kg');
  });
});
