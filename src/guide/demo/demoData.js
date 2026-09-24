/**
 * demoData.js — everything the demo guides show.
 *
 * Bundled with the app. No demo screen imports the API client, a data hook or a
 * payment SDK, so there is nothing here that could reach the network: the guides
 * cannot book, charge, log or send anything because the code to do so is not on
 * these screens at all.
 *
 * The five activities are real rows copied from the live `activities` table —
 * names, prices, durations and descriptions — rather than invented ones, so the
 * practice run matches what members will actually see. The spec asks for exactly
 * this. Prices all sit well under the practice balance, so the "not enough
 * coins" path can never be reached mid-guide.
 */

/** Coins the member appears to have during a practice booking. */
export const DEMO_BALANCE = 500;

export const DEMO_ACTIVITIES = [
  {
    id: 'demo-act-1',
    name: 'Yoga',
    coinPrice: 80,
    durationMinutes: 45,
    description: 'Improve flexibility, balance and mental clarity with guided yoga sessions.',
  },
  {
    id: 'demo-act-2',
    name: 'HIIT',
    coinPrice: 80,
    durationMinutes: 45,
    description: 'High-Intensity Interval Training for maximum calorie burn in minimum time.',
  },
  {
    id: 'demo-act-3',
    name: 'Cycling',
    coinPrice: 60,
    durationMinutes: 30,
    description: 'Indoor cycling class with energetic music and guided resistance training.',
  },
  {
    id: 'demo-act-4',
    name: 'Pickleball',
    coinPrice: 120,
    durationMinutes: 45,
    description: 'Fast-paced paddle sport that combines elements of tennis, badminton, and table tennis.',
  },
  {
    id: 'demo-act-5',
    name: 'Sauna & Steam',
    coinPrice: 10,
    durationMinutes: 30,
    description: 'Relax and recover with our premium sauna and steam room facilities.',
  },
];

/**
 * Three bookable days, worked out when the guide runs: tomorrow, the day after,
 * and three days out. Never today — a slot that has already passed would be
 * shown as full, and the member would be picking from a list with a dead option
 * in it on their very first look at booking.
 */
export function demoDates(now = new Date()) {
  return [1, 2, 3].map((offset) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    d.setHours(0, 0, 0, 0);
    return {
      iso: isoDate(d),
      dow: d.toLocaleString('en', { weekday: 'short' }).toUpperCase(),
      day: d.getDate(),
      label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
    };
  });
}

/** Two slots a day, the same for every date so the guide reads the same each run. */
export const DEMO_SLOTS = [
  { id: 'demo-slot-am', startTime: '07:00', endTime: '07:45', label: '7:00 AM' },
  { id: 'demo-slot-pm', startTime: '18:30', endTime: '19:15', label: '6:30 PM' },
];

/* ── Workout ─────────────────────────────────────────────────────────────── */

/** One template, shown in the picker and then followed through the player. */
export const DEMO_TEMPLATE = {
  id: 'demo-tpl-1',
  name: 'Upper Body Strength',
  category: 'Strength',
  activityTarget: 'Muscle Gain',
  estimatedMinutes: 45,
  exercises: [
    { id: 'demo-ex-1', name: 'Bench Press', sets: 3, targetReps: 8, targetWeight: 40, restSeconds: 90 },
    { id: 'demo-ex-2', name: 'Bent-Over Row', sets: 3, targetReps: 10, targetWeight: 35, restSeconds: 90 },
    { id: 'demo-ex-3', name: 'Shoulder Press', sets: 3, targetReps: 10, targetWeight: 20, restSeconds: 60 },
  ],
};

/** Loose exercises, for the picker's second tab. */
export const DEMO_EXERCISES = [
  { id: 'demo-ex-4', name: 'Lat Pulldown', muscleGroup: 'Back' },
  { id: 'demo-ex-5', name: 'Bicep Curl', muscleGroup: 'Biceps' },
  { id: 'demo-ex-6', name: 'Tricep Pushdown', muscleGroup: 'Triceps' },
];

/** What the summary shows after the demo workout "finishes". */
export const DEMO_SUMMARY = {
  name: DEMO_TEMPLATE.name,
  durationMinutes: 42,
  totalVolume: 2940,
  setsCompleted: 9,
  setsTarget: 9,
  exercises: 3,
};

/* ── Coach chat ──────────────────────────────────────────────────────────── */

export const DEMO_COACH = { name: 'Your coach', initial: 'C' };

export const DEMO_MESSAGES = [
  { id: 'demo-msg-1', mine: false, text: 'Welcome aboard! I’ve set your first week of sessions.' },
  { id: 'demo-msg-2', mine: true, text: 'Thanks — looking forward to starting.' },
  { id: 'demo-msg-3', mine: false, text: 'Any questions about a session, just ask me here.' },
];

/* ── helpers ─────────────────────────────────────────────────────────────── */

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
