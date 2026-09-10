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
