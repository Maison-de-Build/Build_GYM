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

/** Flatten any of the shapes /member/instances can return into one row list. */
export function flattenInstances(source) {
  if (Array.isArray(source)) return source;
  const { today = [], upcoming = [], history = [], range = [] } = source || {};
  return [...history, ...today, ...upcoming, ...range];
}

/** Group instance rows by their local YYYY-MM-DD, de-duplicated by row id. */
export function groupInstancesByDate(source) {
  const byDate = new Map();
  const seen = new Set();
  for (const row of flattenInstances(source)) {
    // The buckets overlap (a completed workout today is in both `today` and
    // `history`, and `range` can repeat either), so drop repeats by id or the
    // day would count the same session twice.
    if (row?.id != null) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
    }
    const key = String(row.workoutDate).slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(row);
  }
  return byDate;
}

/**
 * Build the 7-day strip. Each cell:
 *   { key, iso, label, date, isToday, isPast, isFuture, status, instances }
 *   status: 'completed' → amber tick · 'assigned' → amber dot · null → rest day
 *
 * `anchorIso` re-centres the window when the member browses to another date;
 * omitted, it centres on today exactly as before. `isToday` is always measured
 * against the real clock, never the anchor — the write rules depend on it.
 */
export function buildDayStrip(source, now = new Date(), anchorIso = null) {
  const byDate = groupInstancesByDate(source);

  const todayIso = isoDate(now);
  const anchor = anchorIso ? parseIsoLocal(anchorIso) : now;

  const days = [];
  for (let offset = -STRIP_BEFORE; offset <= STRIP_AFTER; offset += 1) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + offset);
    const iso = isoDate(d);
    const instances = byDate.get(iso) || [];
    days.push({
      key: iso,
      iso,
      label: DAY_ABBR[d.getDay()],
      date: String(d.getDate()).padStart(2, '0'),
      isToday: iso === todayIso,
      isPast: iso < todayIso,
      isFuture: iso > todayIso,
      status: dayStatus(instances),
      instances,
    });
  }
  return days;
}

/**
 * Parse YYYY-MM-DD as a LOCAL date. `new Date('2026-09-04')` is parsed as UTC,
 * which lands on the previous day for anyone west of Greenwich — the calendar
 * would then select the wrong cell.
 */
export function parseIsoLocal(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * What a member may do on a given day. Logging is today-only: a past session is
 * a record and a future one is a plan, so neither may be started or edited from
 * the calendar. Scheduling stays open for today and the future because that is
 * the freestyle flow's whole purpose (and the backend enforces today..+14 too).
 */
export function dayPermissions(day) {
  if (!day) return { canLog: false, canSchedule: false, reason: null };
  if (day.isToday) return { canLog: true, canSchedule: true, reason: null };
  if (day.isPast) return { canLog: false, canSchedule: false, reason: 'Past day — view only' };
  return { canLog: false, canSchedule: true, reason: 'Scheduled — opens on the day' };
}

/** First/last day of the month containing `iso`, as ISO dates. */
export function monthBounds(iso) {
  const d = parseIsoLocal(iso);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: isoDate(first), to: isoDate(last) };
}

/**
 * A month laid out as calendar weeks, Monday-first, padded with nulls so each
 * row has exactly 7 cells.
 */
export function monthGrid(iso, byDate = new Map(), now = new Date()) {
  const d = parseIsoLocal(iso);
  const year = d.getFullYear();
  const month = d.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-first offset
  const todayIso = isoDate(now);

  const cells = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const cellIso = isoDate(new Date(year, month, day));
    const instances = byDate.get(cellIso) || [];
    cells.push({
      iso: cellIso,
      day,
      isToday: cellIso === todayIso,
      isPast: cellIso < todayIso,
      status: dayStatus(instances),
      instances,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** "September 2026" for an ISO date. */
export function monthTitle(iso) {
  return parseIsoLocal(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Shift an ISO date by N whole months, clamping the day (31 Jan −1 → 28/29 Feb). */
export function shiftMonth(iso, delta) {
  const d = parseIsoLocal(iso);
  const target = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return isoDate(target);
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
  // Snapshot weights come back as numerics ("40.00"), which the pack never
  // shows — its targets read "@ 22 kg", not "@ 22.00 kg". Trim before
  // formatting so a whole number loses its decimals and 22.5 keeps them.
  const base = formatTarget(ex?.targetWeight != null ? { ...ex, targetWeight: trimWeight(ex.targetWeight) } : ex);
  const type = ex?.measurementType || 'weight_reps';
  if (type === 'weight_reps' && ex?.targetWeight == null) {
    if (ex?.equipmentType === 'bodyweight' || ex?.equipment === 'bodyweight') return `${base} @ Bodyweight`;
    if (ex?.weightSource === 'uncalibrated') return `${base} @ Weight TBD`;
  }
  return base;
}

/** "40.00" → 40, "22.50" → 22.5. Returns the input unchanged if not numeric. */
export function trimWeight(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}


/**
 * Headline personal record for screen 16. `personal_records` stores one row per
 * PR type ({ prType, value, achievedAt }) with no weight+reps pairing, and
 * GET /member/stats/prs/:id wraps them in { prs, estimated1RM } — passing that
 * object straight to Array.filter crashed the screen. Accepts the array, that
 * wrapper, or null; returns null when there is nothing to show.
 */
export function pickHeadlinePr(input) {
  const prs = Array.isArray(input?.prs) ? input.prs : (Array.isArray(input) ? input : []);
  if (!prs.length) return null;
  const byType = (t) => prs.find((p) => p.prType === t);
  const weight = byType('max_weight');
  const reps = byType('max_reps');
  const volume = byType('max_volume');
  const head = weight || reps || volume;
  if (!head || head.value == null) return null;
  return {
    weight: weight != null ? Number(weight.value) : null,
    reps: reps != null ? Number(reps.value) : null,
    volume: volume != null ? Number(volume.value) : null,
    achievedAt: head.achievedAt || head.createdAt || null,
  };
}

/** "70 kg · best 6 reps" / "6 reps" / "1,240 kg volume" / "—". */
export function prHeadlineLabel(pr) {
  if (!pr) return '—';
  if (pr.weight != null) {
    return pr.reps != null ? `${trimWeight(pr.weight)} kg · best ${pr.reps} reps` : `${trimWeight(pr.weight)} kg`;
  }
  if (pr.reps != null) return `${pr.reps} reps`;
  if (pr.volume != null) return `${Math.round(pr.volume).toLocaleString()} kg volume`;
  return '—';
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
