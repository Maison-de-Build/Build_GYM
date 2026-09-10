/**
 * mdbWorkout.js — derivations the MDB calendar screens need but that no single
 * endpoint returns directly (target load, est. time, intensity, focus, and the
 * 7-day strip). Pure functions, no I/O, so they are unit-testable.
 *
 * Every derivation degrades gracefully: a snapshot missing a field yields null
 * and the caller renders an em-dash rather than a wrong number.
 */
import { formatTarget } from './measurement';

/** Local (device) YYYY-MM-DD — matches how the backend keys workout_date. */
export const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/**
 * The pack's strip renders WED 02 … TUE 08 with today (SUN 06) fifth of seven:
 * four days of recent history, today, then two upcoming. Kept as named options
 * so the window is trivial to re-balance.
 */
export const STRIP_BEFORE = 4;
export const STRIP_AFTER = 2;

/**
 * Build the 7-day strip from `/member/instances` ({ today, upcoming, history }).
 * Each cell: { key, label, date, iso, isToday, status, instances }.
 *   status: 'completed' → amber tick · 'assigned' → amber dot · null → rest day
 */
export function buildDayStrip({ today = [], upcoming = [], history = [] } = {}, now = new Date()) {
  const byDate = new Map();
  const add = (row) => {
    const key = String(row.workoutDate).slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(row);
  };
  [...history, ...today, ...upcoming].forEach(add);

  const todayIso = isoDate(now);
  const days = [];
  for (let offset = -STRIP_BEFORE; offset <= STRIP_AFTER; offset += 1) {
    const d = new Date(now);
    d.setDate(now.getDate() + offset);
    const iso = isoDate(d);
    const instances = byDate.get(iso) || [];
    days.push({
      key: iso,
      iso,
      label: DAY_ABBR[d.getDay()],
      date: String(d.getDate()).padStart(2, '0'),
      isToday: iso === todayIso,
      status: dayStatus(instances),
      instances,
    });
  }
  return days;
}

function dayStatus(instances) {
  if (!instances.length) return null;
  if (instances.some((i) => i.status === 'completed' || i.status === 'partial')) return 'completed';
  if (instances.some((i) => i.status === 'assigned' || i.status === 'in_progress')) return 'assigned';
  return null;
}

/** Exercise list off an instance snapshot, ordered and letter-labelled A, B, C… */
export function sequenceOf(instance) {
  const list = instance?.snapshot?.exercises || instance?.exercises || [];
  return [...list]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((ex, i) => ({
      ...ex,
      letter: String.fromCharCode(65 + i),
      target: targetLine(ex),
    }));
}

/**
 * "3 × 10 @ 22 kg" — the shared formatter, plus the pack's "@ Bodyweight"
 * wording for a bodyweight exercise with no prescribed load.
 */
export function targetLine(ex) {
  const base = formatTarget(ex);
  const type = ex?.measurementType || 'weight_reps';
  if (type === 'weight_reps' && ex?.targetWeight == null) {
    if (ex?.equipmentType === 'bodyweight' || ex?.equipment === 'bodyweight') return `${base} @ Bodyweight`;
    if (ex?.weightSource === 'uncalibrated') return `${base} @ Weight TBD`;
  }
  return base;
}

/** Prescribed tonnage: Σ sets × reps × weight, weight-bearing exercises only. */
export function targetLoadKg(exercises = []) {
  let total = 0;
  let counted = 0;
  for (const ex of exercises) {
    const sets = Number(ex.sets ?? ex.targetSets);
    const reps = Number(ex.targetReps);
    const weight = Number(ex.targetWeight);
    if (!sets || !reps || !weight) continue;
    total += sets * reps * weight;
    counted += 1;
  }
  return counted ? Math.round(total) : null;
}

/**
 * Est. time = Σ sets × (rest + working time). 45s per set is the pack's own
 * pacing assumption (its 6-exercise / 16-set sample reads "55m").
 */
const WORK_SECONDS_PER_SET = 45;
export function estimatedMinutes(exercises = []) {
  if (!exercises.length) return null;
  let seconds = 0;
  for (const ex of exercises) {
    const sets = Number(ex.sets ?? ex.targetSets) || 3;
    const rest = Number(ex.restSeconds ?? 90);
    seconds += sets * (rest + WORK_SECONDS_PER_SET);
  }
  return Math.round(seconds / 60);
}

/** Total prescribed sets ("06 Sets Plan"). */
export function totalSets(exercises = []) {
  return exercises.reduce((n, ex) => n + (Number(ex.sets ?? ex.targetSets) || 0), 0);
}

/**
 * Relative intensity. Prefers the trainer's own % prescription when present
 * (that is real data); otherwise falls back to the standard rep-range reading —
 * low reps = strength/high intensity, high reps = endurance/low.
 */
export function intensityLabel(exercises = []) {
  const pcts = exercises.map((e) => Number(e.originalPercentage)).filter((n) => n > 0);
  if (pcts.length) {
    const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    if (avg >= 82) return 'High';
    if (avg >= 68) return 'Moderate';
    return 'Low';
  }
  const reps = exercises.map((e) => Number(e.targetReps)).filter((n) => n > 0);
  if (!reps.length) return null;
  const avg = reps.reduce((a, b) => a + b, 0) / reps.length;
  if (avg <= 6) return 'High';
  if (avg <= 12) return 'Moderate';
  return 'Low';
}

/**
 * Training focus. Uses the template's activity target when the instance carries
 * one, else the most-represented primary muscle group in the sequence.
 */
export function focusLabel(instance) {
  const target = instance?.activityTarget || instance?.snapshot?.activityTarget;
  if (target) return titleCase(target);

  const exercises = instance?.snapshot?.exercises || [];
  const tally = {};
  for (const ex of exercises) {
    const g = ex.muscleGroupPrimary;
    if (g) tally[g] = (tally[g] || 0) + 1;
  }
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  return top ? titleCase(top[0]) : null;
}

/** "Push Day — Upper Body Power" → initials "KT" for the coach avatar. */
export function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function titleCase(v) {
  return String(v || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "September 2026" for the month header. */
export function monthLabel(d = new Date()) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** "Today, 09:00" / "Yesterday, 18:30" / "28 Aug, 07:15" for last-trained lines. */
export function relativeDateTime(value, now = new Date()) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`;
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
