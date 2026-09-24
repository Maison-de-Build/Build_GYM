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

    expect(free.map((s) => s.id)).toEqual(['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8']);
    expect(coached.map((s) => s.id)).toEqual(['W4', 'W5', 'W6', 'W7', 'W8']);
  });

  it('gives both versions the identical logging half', () => {
    const free = firstWorkoutSteps({ hasCoach: false }).filter((s) => s.id >= 'W4');
    expect(firstWorkoutSteps({ hasCoach: true })).toEqual(free);
  });

  it('never mentions building a template, which no member can do', () => {
    for (const s of firstWorkoutSteps()) {
      expect(`${s.title} ${s.body}`).not.toMatch(/build (your own|a template)|create a template/i);
    }
  });

  it('walks choice, then player, then summary', () => {
    const screens = [...new Set(firstWorkoutSteps().map((s) => s.screen))];
    expect(screens).toEqual(['GuideDemoWorkoutChoice', 'GuideDemoPlayer', 'GuideDemoSummary']);
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

  it('runs list, detail, success, bookings, transactions in that order', () => {
    const screens = [...new Set(bookingPracticeSteps().map((s) => s.screen))];
    expect(screens).toEqual([
      'GuideDemoActivities', 'GuideDemoActivityDetail', 'GuideDemoBookingSuccess',
      'GuideDemoMyBookings', 'GuideDemoTransactions',
    ]);
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
  it('is two steps, both on the demo chat', () => {
    const steps = coachChatSteps();
    expect(steps.map((s) => s.id)).toEqual(['C1', 'C2']);
    for (const s of steps) expect(s.screen).toBe('GuideDemoChat');
  });

  it('never suggests the guide sends anything', () => {
    for (const s of coachChatSteps()) {
      expect(`${s.title} ${s.body}`).not.toMatch(/we(’|')?ll send|sends for you/i);
    }
  });
});
