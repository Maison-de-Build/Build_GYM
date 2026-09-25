import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STATE, DEFAULT_CONFIG, GUIDE_KEYS,
  eligibleGuides, guideProgress, isCardExhausted, shouldShowCard,
  shouldAutoStartWelcome, workoutGuideVariant, mergeLocalState,
} from '../guideRules.js';

const config = (over = {}) => ({
  ...DEFAULT_CONFIG,
  welcome: true, firstWorkout: true, bookingPractice: true, coachChat: true,
  ...over,
});
const state = (over = {}) => ({
  ...DEFAULT_STATE,
  ...over,
  guides: { ...DEFAULT_STATE.guides, ...(over.guides || {}) },
});
const withStatus = (key, status) => state({ guides: { [key]: { status } } });

/* ── eligibleGuides ──────────────────────────────────────────────────────── */
describe('eligibleGuides', () => {
  it('offers two guides to a member with no coach', () => {
    expect(eligibleGuides(config({ hasCoach: false })))
      .toEqual(['first_workout', 'booking_practice']);
  });

  it('adds the coach row only when there is a coach to message', () => {
    expect(eligibleGuides(config({ hasCoach: true })))
      .toEqual(['first_workout', 'booking_practice', 'coach_chat']);
  });

  // A coached member whose coach guide is switched off server-side must not get
  // the row, even though they do have a coach.
  it('respects the server switch even for a coached member', () => {
    expect(eligibleGuides(config({ hasCoach: true, coachChat: false })))
      .toEqual(['first_workout', 'booking_practice']);
  });

  it('is empty when every switch is off', () => {
    expect(eligibleGuides(DEFAULT_CONFIG)).toEqual([]);
  });

  it('drops a switched-off guide and keeps the order of the rest', () => {
    expect(eligibleGuides(config({ firstWorkout: false, hasCoach: true })))
      .toEqual(['booking_practice', 'coach_chat']);
  });
});

/* ── guideProgress ───────────────────────────────────────────────────────── */
describe('guideProgress', () => {
  it('counts out of 2 without a coach and 3 with one', () => {
    expect(guideProgress(DEFAULT_STATE, config({ hasCoach: false })))
      .toEqual({ done: 0, total: 2 });
    expect(guideProgress(DEFAULT_STATE, config({ hasCoach: true })))
      .toEqual({ done: 0, total: 3 });
  });

  it('counts a skipped guide as dealt with, not outstanding', () => {
    expect(guideProgress(withStatus('first_workout', 'skipped'), config({ hasCoach: false })))
      .toEqual({ done: 1, total: 2 });
  });

  // A finished coach guide must not inflate the count for a member who lost
  // their coach — the row isn't there any more.
  it('ignores a finished coach guide once the coach is gone', () => {
    const s = withStatus('coach_chat', 'completed');
    expect(guideProgress(s, config({ hasCoach: false }))).toEqual({ done: 0, total: 2 });
    expect(guideProgress(s, config({ hasCoach: true }))).toEqual({ done: 1, total: 3 });
  });
});

/* ── isCardExhausted / shouldShowCard ────────────────────────────────────── */
describe('isCardExhausted', () => {
  it('is false while anything is still unstarted', () => {
    expect(isCardExhausted(DEFAULT_STATE, config({ hasCoach: true }))).toBe(false);
  });

  it('is true once every eligible row is done or skipped', () => {
    const s = state({
      guides: {
        first_workout: { status: 'completed' },
        booking_practice: { status: 'skipped' },
      },
    });
    expect(isCardExhausted(s, config({ hasCoach: false }))).toBe(true);
    // The same member with a coach still has the chat row outstanding.
    expect(isCardExhausted(s, config({ hasCoach: true }))).toBe(false);
  });

  it('treats no eligible guides as nothing left to show', () => {
    expect(isCardExhausted(DEFAULT_STATE, DEFAULT_CONFIG)).toBe(true);
  });
});

describe('shouldShowCard', () => {
  it('shows for a fresh member with guides switched on', () => {
    expect(shouldShowCard(DEFAULT_STATE, config())).toBe(true);
  });

  it('stays hidden once dismissed, even with rows outstanding', () => {
    expect(shouldShowCard(state({ card_dismissed: true }), config())).toBe(false);
  });

  it('hides once everything is dealt with', () => {
    const s = state({
      guides: {
        first_workout: { status: 'completed' },
        booking_practice: { status: 'completed' },
      },
    });
    expect(shouldShowCard(s, config({ hasCoach: false }))).toBe(false);
  });
});

/* ── shouldAutoStartWelcome ──────────────────────────────────────────────── */
describe('shouldAutoStartWelcome', () => {
  it('runs once for a member who has never seen it', () => {
    expect(shouldAutoStartWelcome(DEFAULT_STATE, config())).toBe(true);
  });

  // Neither a finished nor a skipped tour comes back on its own; from then on
  // it lives in Profile > Replay guide.
  it('never restarts itself after completion or a skip', () => {
    expect(shouldAutoStartWelcome(state({ welcome_tour: 'completed' }), config())).toBe(false);
    expect(shouldAutoStartWelcome(state({ welcome_tour: 'skipped' }), config())).toBe(false);
  });

  it('does not start while the server switch is off', () => {
    expect(shouldAutoStartWelcome(DEFAULT_STATE, config({ welcome: false }))).toBe(false);
  });

  // Defaults leave every switch off, so a failed config fetch starts nothing.
  it('starts nothing when the config never loaded', () => {
    expect(shouldAutoStartWelcome(DEFAULT_STATE, DEFAULT_CONFIG)).toBe(false);
  });
});

/* ── workoutGuideVariant ─────────────────────────────────────────────────── */
describe('workoutGuideVariant', () => {
  // A coached member cannot plan a workout at all — the API refuses it — so
  // their guide has to start at the player instead.
  it('gives a coached member the version with no planning steps', () => {
    expect(workoutGuideVariant(config({ hasCoach: true }))).toBe('coached');
  });

  it('gives everyone else the full version', () => {
    expect(workoutGuideVariant(config({ hasCoach: false }))).toBe('freestyle');
  });
});

/* ── mergeLocalState ─────────────────────────────────────────────────────── */
describe('mergeLocalState', () => {
  it('applies a guide status without disturbing the others', () => {
    const out = mergeLocalState(DEFAULT_STATE, { guides: { booking_practice: { status: 'completed' } } });
    expect(out.guides.booking_practice.status).toBe('completed');
    expect(out.guides.first_workout.status).toBe('not_started');
  });

  it('applies the tour status and the dismissal flag', () => {
    expect(mergeLocalState(DEFAULT_STATE, { welcome_tour: 'skipped' }).welcome_tour).toBe('skipped');
    expect(mergeLocalState(DEFAULT_STATE, { card_dismissed: true }).card_dismissed).toBe(true);
  });

  it('ignores a guide key it does not know', () => {
    const out = mergeLocalState(DEFAULT_STATE, { guides: { nutrition_tour: { status: 'completed' } } });
    expect(out.guides.nutrition_tour).toBeUndefined();
    expect(Object.keys(out.guides).sort()).toEqual([...GUIDE_KEYS].sort());
  });

  it('leaves the original untouched', () => {
    const before = JSON.stringify(DEFAULT_STATE);
    mergeLocalState(DEFAULT_STATE, { guides: { first_workout: { status: 'completed' } } });
    expect(JSON.stringify(DEFAULT_STATE)).toBe(before);
  });

  it('treats an empty patch as a no-op', () => {
    expect(mergeLocalState(DEFAULT_STATE, {})).toEqual(DEFAULT_STATE);
  });
});

/* ── shouldInterceptEntry ────────────────────────────────────────────────── */
import { shouldInterceptEntry } from '../guideRules.js';

describe('shouldInterceptEntry', () => {
  it('runs the guide on the first tap of its Home button', () => {
    expect(shouldInterceptEntry(DEFAULT_STATE, config(), 'booking_practice')).toBe(true);
    expect(shouldInterceptEntry(DEFAULT_STATE, config(), 'first_workout')).toBe(true);
  });

  // Afterwards the button must open the real screen, or the member could never
  // reach Activities from Home.
  it('lets the button work normally once the guide is done or skipped', () => {
    expect(shouldInterceptEntry(withStatus('booking_practice', 'completed'), config(), 'booking_practice')).toBe(false);
    expect(shouldInterceptEntry(withStatus('booking_practice', 'skipped'), config(), 'booking_practice')).toBe(false);
  });

  it('never intercepts after the member hid the guides', () => {
    expect(shouldInterceptEntry(state({ card_dismissed: true }), config(), 'booking_practice')).toBe(false);
  });

  it('respects the server switch and the coach rule', () => {
    expect(shouldInterceptEntry(DEFAULT_STATE, config({ bookingPractice: false }), 'booking_practice')).toBe(false);
    expect(shouldInterceptEntry(DEFAULT_STATE, config({ hasCoach: false }), 'coach_chat')).toBe(false);
    expect(shouldInterceptEntry(DEFAULT_STATE, config({ hasCoach: true }), 'coach_chat')).toBe(true);
  });

  it('does nothing before the config has loaded', () => {
    expect(shouldInterceptEntry(DEFAULT_STATE, DEFAULT_CONFIG, 'booking_practice')).toBe(false);
  });
});
