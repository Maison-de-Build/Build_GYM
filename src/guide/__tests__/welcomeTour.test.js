import { describe, it, expect } from 'vitest';

import { welcomeTourSteps } from '../steps/welcomeTour.js';
import { T } from '../targets.js';
import { TOUR, ACTIONS } from '../copy.js';

describe('welcomeTourSteps', () => {
  it('is five steps, in the order they appear down Home', () => {
    const steps = welcomeTourSteps();
    expect(steps.map((s) => s.id)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
    expect(steps.map((s) => s.target)).toEqual([
      T.HOME_TODAY_WORKOUT, T.HOME_CALORIES, T.HOME_COINS, T.HOME_CHECK_IN, T.HOME_GET_STARTED,
    ]);
  });

  // The tour shows the member around; tapping a highlight must not open the
  // feature underneath it.
  it('is passive throughout, and a tap on the target advances', () => {
    for (const step of welcomeTourSteps()) {
      expect(step.mode).toBe('passive');
      expect(step.advanceOn).toBe('tap');
    }
  });

  it('offers Skip on every step and ends on Done', () => {
    const steps = welcomeTourSteps();
    for (const step of steps) expect(step.exitLabel).toBe(ACTIONS.skip);
    expect(steps.slice(0, 4).map((s) => s.primaryLabel)).toEqual(Array(4).fill(ACTIONS.next));
    expect(steps[4].primaryLabel).toBe(ACTIONS.done);
  });

  // A coached member cannot pick a template or add exercises — the API refuses
  // it and Home gives them no button — so the freestyle line would describe
  // something they will never be able to do.
  it('changes only the first step for a coached member', () => {
    const free = welcomeTourSteps({ hasCoach: false });
    const coached = welcomeTourSteps({ hasCoach: true });

    expect(free[0].body).toBe(TOUR.todayWorkoutFreestyle.body);
    expect(coached[0].body).toBe(TOUR.todayWorkoutCoached.body);
    expect(coached[0].title).toBe(free[0].title);

    // Everything after step 1 is identical.
    expect(coached.slice(1)).toEqual(free.slice(1));
  });

  it('defaults to the freestyle wording when nothing is passed', () => {
    expect(welcomeTourSteps()[0].body).toBe(TOUR.todayWorkoutFreestyle.body);
    expect(welcomeTourSteps({})[0].body).toBe(TOUR.todayWorkoutFreestyle.body);
  });

  it('gives every step a title and a body', () => {
    for (const step of welcomeTourSteps({ hasCoach: true })) {
      expect(step.title?.length).toBeGreaterThan(0);
      expect(step.body?.length).toBeGreaterThan(0);
    }
  });

  // The engine looks targets up by id; a step naming one no screen registers
  // would sit on the five-second fallback instead of pointing at anything.
  it('only names targets that exist in the registry', () => {
    const known = new Set(Object.values(T));
    for (const step of welcomeTourSteps()) expect(known.has(step.target)).toBe(true);
  });

  it('builds a fresh list each call, so a replay cannot inherit a mutation', () => {
    const first = welcomeTourSteps();
    first[0].title = 'mutated';
    expect(welcomeTourSteps()[0].title).toBe(TOUR.todayWorkoutFreestyle.title);
  });
});

describe('welcomeTourSteps without the Get started card', () => {
  // Replaying the tour after hiding the card used to point step 5 at a card
  // that wasn't there — the "This didn't load" stop QA hit.
  it('ends at step 4 when the card will not show', () => {
    const steps = welcomeTourSteps({ showCard: false });
    expect(steps.map((s) => s.id)).toEqual(['A1', 'A2', 'A3', 'A4']);
    expect(steps.map((s) => s.target)).not.toContain(T.HOME_GET_STARTED);
  });

  it('still ends on Done', () => {
    const steps = welcomeTourSteps({ showCard: false });
    expect(steps[steps.length - 1].primaryLabel).toBe(ACTIONS.done);
    expect(steps.slice(0, -1).every((s) => s.primaryLabel === ACTIONS.next)).toBe(true);
  });

  it('keeps all five steps when the card is showing', () => {
    expect(welcomeTourSteps({ showCard: true })).toHaveLength(5);
    expect(welcomeTourSteps()).toHaveLength(5);
  });
});
