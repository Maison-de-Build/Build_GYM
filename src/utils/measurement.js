// measurement.js — single source of truth for rendering the four exercise
// measurement types (Doc 4 §3.2.5): Weight+Reps · Reps · Time · Distance.
// The DB stores distance in METERS and time in SECONDS; the UI shows mm:ss for
// time and a km/m switch for distance. Use these helpers everywhere a target or
// a logged set is rendered so the four types stay consistent across screens.

export const MEASUREMENT_LABELS = {
  weight_reps: 'Weight + Reps',
  reps: 'Reps only',
  time: 'Time',
  distance: 'Distance',
};

// Which per-set inputs to render for a given measurement type (Sets/Rest handled
// by the caller). Returns an array of field keys, in the order they appear on
// screen — the pack's session table is SET · REPS · KG · STATUS.
export function inputFieldsFor(type) {
  switch (type) {
    case 'reps': return ['reps'];
    case 'time': return ['time'];
    case 'distance': return ['distance'];
    case 'weight_reps':
    default: return ['reps', 'weight'];
  }
}

export function secondsToMmss(total) {
  const n = Number(total);
  if (total == null || isNaN(n)) return '00:00';
  const t = Math.max(0, Math.round(n));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function mmssToSeconds(text) {
  if (!text) return 0;
  const parts = String(text).split(':').map((p) => parseInt(p, 10) || 0);
  if (parts.length >= 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export function metersToKm(meters) {
  const n = Number(meters);
  return meters == null || isNaN(n) ? 0 : n / 1000;
}

export function kmToMeters(km) {
  return Math.round((Number(km) || 0) * 1000);
}

// "2 km" / "1.5 km" / "350 m"
export function formatDistance(meters) {
  const m = Number(meters) || 0;
  if (m >= 1000) return `${parseFloat((m / 1000).toFixed(2))} km`;
  return `${Math.round(m)} m`;
}

// Target line, e.g. "4 × 8 @ 60 kg" · "4 × 8" · "3 × 02:00" · "5 × 2 km".
//
// Reps and weight are no longer asked for when a member schedules their own
// workout — they pick what they lift set by set instead — so a null rep
// target is now normal, not missing data. Those render as plain "3 sets"
// rather than "3 × —", which read like something had failed to load.
export function formatTarget(ex) {
  const type = (ex && ex.measurementType) || 'weight_reps';
  const sets = ex && (ex.targetSets != null ? ex.targetSets : ex.sets);
  const hasSets = sets != null && sets !== '';
  const prefix = hasSets ? `${sets} × ` : '';
  const setsOnly = hasSets ? `${sets} set${Number(sets) === 1 ? '' : 's'}` : '—';
  switch (type) {
    case 'reps':
      return ex?.targetReps == null ? setsOnly : `${prefix}${ex.targetReps}`;
    case 'time':
      return `${prefix}${secondsToMmss(ex?.targetTimeSeconds)}`;
    case 'distance':
      return `${prefix}${formatDistance(ex?.targetDistance)}`;
    case 'weight_reps':
    default: {
      const w = ex?.targetWeight;
      const suffix = w != null ? ` @ ${w} kg` : '';
      if (ex?.targetReps == null) return `${setsOnly}${suffix}`;
      return `${prefix}${ex.targetReps}${suffix}`;
    }
  }
}

// Logged-set line from a set_log row, e.g. "60 kg × 8" · "× 8" · "02:00" · "2 km".
export function formatLogged(set, type) {
  const t = type || (set && set.measurementType) || 'weight_reps';
  switch (t) {
    case 'reps':
      return `× ${set?.actualReps ?? '—'}`;
    case 'time':
      return secondsToMmss(set?.actualTimeSeconds);
    case 'distance':
      return formatDistance(set?.actualDistance);
    case 'weight_reps':
    default:
      return `${set?.actualWeight ?? '—'} kg × ${set?.actualReps ?? '—'}`;
  }
}

// Display metadata per PR type, incl. the new Time/Distance records.
export function prMeta(prType) {
  switch (prType) {
    case 'max_weight': return { label: 'Max Weight', shortLabel: 'Heaviest', icon: 'barbell', unit: 'kg', format: (v) => `${v} kg` };
    case 'max_reps': return { label: 'Max Reps', shortLabel: 'Most reps', icon: 'repeat', unit: 'reps', format: (v) => `${v} reps` };
    case 'max_volume': return { label: 'Max Volume', shortLabel: 'Best volume', icon: 'layers', unit: 'kg', format: (v) => `${Math.round(v)} kg` };
    case 'max_time': return { label: 'Longest Time', shortLabel: 'Longest', icon: 'time', unit: '', format: (v) => secondsToMmss(v) };
    case 'max_distance': return { label: 'Farthest', shortLabel: 'Farthest', icon: 'walk', unit: '', format: (v) => formatDistance(v) };
    default: return { label: prType, shortLabel: prType, icon: 'star', unit: '', format: (v) => String(v) };
  }
}
