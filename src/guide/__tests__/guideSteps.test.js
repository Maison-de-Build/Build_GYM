import { describe, it, expect } from 'vitest';

import { firstWorkoutSteps } from '../steps/firstWorkout.js';
import { bookingPracticeSteps } from '../steps/bookingPractice.js';
import { coachChatSteps } from '../steps/coachChat.js';
import { welcomeTourSteps } from '../steps/welcomeTour.js';
import { T } from '../targets.js';
import { ACTIONS } from '../copy.js';

const ALL = [
  ['welcome tour', () => welcomeTourSteps()],
  ['first workout, freestyle', () => firstWorkoutSteps({ hasCoach: false })],
  ['first workout, coached', () => firstWorkoutSteps({ hasCoach: true })],
  ['booking practice', () => bookingPracticeSteps()],
  ['coach chat', () => coachChatSteps()],
];

/* ── Rules that hold for every guide ─────────────────────────────────────── */
describe.each(ALL)('%s', (_name, build) => {
  const steps = build();

  it('has at least one step, each with an id, title and body', () => {
    expect(steps.length).toBeGreaterThan(0);
    for (const s of steps) {
      expect(s.id?.length).toBeGreaterThan(0);
      expect(s.title?.length).toBeGreaterThan(0);
      expect(s.body?.length).toBeGreaterThan(0);
    }
  });

  it('uses step ids that are unique within the guide', () => {
    const ids = steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // A step naming an unregistered target sits on the five-second fallback
  // instead of highlighting anything.
  it('only names targets from the registry', () => {
    const known = new Set(Object.values(T));
    for (const s of steps) expect(known.has(s.target), `${s.id} → ${s.target}`).toBe(true);
  });

  it('is passive throughout, so a tap never opens the feature underneath', () => {
    for (const s of steps) {
      expect(s.mode).toBe('passive');
      expect(s.advanceOn).toBe('tap');
    }
  });

  it('gives every step a way out and a way on', () => {
    for (const s of steps) {
      expect(s.exitLabel?.length).toBeGreaterThan(0);
      expect(s.primaryLabel?.length).toBeGreaterThan(0);
    }
  });

  it('ends on Done', () => {
    expect(steps[steps.length - 1].primaryLabel).toBe(ACTIONS.done);
  });

  it('builds a fresh list each call, so a replay cannot inherit a mutation', () => {
    const first = build();
    first[0].title = 'mutated';
    expect(build()[0].title).not.toBe('mutated');
  });
});

/* ── first workout ───────────────────────────────────────────────────────── */
describe('firstWorkoutSteps', () => {
  // Self-assign is refused at the API for a member with a trainer, and Home
  // gives them no add button, so the planning steps would point at a thing
  // they cannot do.
  it('drops the planning half for a coached member', () => {
    const free = firstWorkoutSteps({ hasCoach: false });
    const coached = firstWorkoutSteps({ hasCoach: true });

    expect(free.map((s) => s.id)).toEqual(['W0', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8']);
    expect(coached.map((s) => s.id)).toEqual(['W0', 'W4', 'W5', 'W6', 'W7', 'W8']);
  });

  it('gives both versions the identical logging half', () => {
    const logging = (list) => list.filter((s) => s.id >= 'W4');
    expect(logging(firstWorkoutSteps({ hasCoach: true })))
      .toEqual(logging(firstWorkoutSteps({ hasCoach: false })));
  });

  // A coached member has no add button, so their first step points at the card
  // their coach's session appears on instead.
  it('opens on the add button for freestyle and the workout card when coached', () => {
    expect(firstWorkoutSteps({ hasCoach: false })[0].target).toBe(T.HOME_ADD_WORKOUT);
    expect(firstWorkoutSteps({ hasCoach: true })[0].target).toBe(T.HOME_TODAY_WORKOUT);
  });

  it('never mentions building a template, which no member can do', () => {
    for (const s of firstWorkoutSteps()) {
      expect(`${s.title} ${s.body}`).not.toMatch(/build (your own|a template)|create a template/i);
    }
  });

  it('walks Home, then choice, then player, then summary', () => {
    const screens = [...new Set(firstWorkoutSteps().map((s) => s.screen))];
    expect(screens).toEqual(['MainTabs', 'GuideDemoWorkoutChoice', 'GuideDemoPlayer', 'GuideDemoSummary']);
  });

  it('defaults to the freestyle version', () => {
    expect(firstWorkoutSteps()).toEqual(firstWorkoutSteps({ hasCoach: false }));
  });
});

/* ── booking practice ────────────────────────────────────────────────────── */
describe('bookingPracticeSteps', () => {
  // `activities` has no category column, so only "All" ever returns rows.
  // Teaching the filter would teach a control that does nothing.
  it('has no category-filter step', () => {
    for (const s of bookingPracticeSteps()) {
      expect(`${s.title} ${s.body}`).not.toMatch(/categor|filter/i);
    }
    const targets = bookingPracticeSteps().map((s) => s.target);
    expect(targets).not.toContain('demoBooking.category');
  });

  it('runs Home, list, detail, success, bookings, transactions in that order', () => {
    const screens = [...new Set(bookingPracticeSteps().map((s) => s.screen))];
    expect(screens).toEqual([
      'MainTabs', 'GuideDemoActivities', 'GuideDemoActivityDetail', 'GuideDemoBookingSuccess',
      'GuideDemoMyBookings', 'GuideDemoTransactions',
    ]);
  });

  it('starts on the real ACTIVITIES tile', () => {
    expect(bookingPracticeSteps()[0].target).toBe(T.HOME_ACTIVITIES);
  });

  // My Bookings is not on Home, so the guide reaches it the way the real app
  // does — from the success screen.
  it('reaches My Bookings from the success screen', () => {
    const steps = bookingPracticeSteps();
    const viaSuccess = steps.find((s) => s.target === T.DB_VIEW_BOOKINGS);
    expect(viaSuccess?.screen).toBe('GuideDemoBookingSuccess');
    const bookings = steps.findIndex((s) => s.screen === 'GuideDemoMyBookings');
    expect(bookings).toBeGreaterThan(steps.indexOf(viaSuccess));
  });

  it('labels its exit as leaving practice, not skipping a workout', () => {
    for (const s of bookingPracticeSteps()) expect(s.exitLabel).toBe(ACTIONS.exitPractice);
  });
});

/* ── coach chat ──────────────────────────────────────────────────────────── */
describe('coachChatSteps', () => {
  it('starts on the MY COACH card, then two steps on the demo chat', () => {
    const steps = coachChatSteps();
    expect(steps.map((s) => s.id)).toEqual(['C0', 'C1', 'C2']);
    expect(steps[0]).toMatchObject({ screen: 'MainTabs', target: T.HOME_COACH });
    for (const s of steps.slice(1)) expect(s.screen).toBe('GuideDemoChat');
  });

  it('never suggests the guide sends anything', () => {
    for (const s of coachChatSteps()) {
      expect(`${s.title} ${s.body}`).not.toMatch(/we(’|')?ll send|sends for you/i);
    }
  });
});

/* ── Rules the engine relies on ──────────────────────────────────────────── */
describe('every guide', () => {
  // The engine abandons a guide when the member lands on a screen other than
  // the step's own. A step with no screen could never be checked.
  it.each(ALL)('%s names the screen every step lives on', (_n, build) => {
    for (const s of build()) expect(s.screen, s.id).toBeTruthy();
  });

  // Guides 2–4 open on the real Home button that leads to the feature, before
  // any practice screen, so the member learns where it lives.
  it.each([
    ['first workout, freestyle', () => firstWorkoutSteps({ hasCoach: false })],
    ['first workout, coached', () => firstWorkoutSteps({ hasCoach: true })],
    ['booking practice', () => bookingPracticeSteps()],
    ['coach chat', () => coachChatSteps()],
  ])('%s starts on Home, and that step moves on by itself if the button is missing', (_n, build) => {
    const [first, second] = build();
    expect(first.screen).toBe('MainTabs');
    expect(first.optional).toBe(true);
    expect(second.screen).not.toBe('MainTabs');
  });

  // Only practice screens carry the practice banner, so the Home step of these
  // guides must not be one.
  it('never marks the real Home as a practice screen', () => {
    for (const [, build] of ALL) {
      for (const s of build().filter((x) => x.screen === 'MainTabs')) {
        expect(s.screen.startsWith('GuideDemo')).toBe(false);
      }
    }
  });
});
