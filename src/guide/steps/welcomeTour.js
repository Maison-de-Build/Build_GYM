/**
 * welcomeTour.js — Part A, the five spotlights on Home.
 *
 * Passive throughout: the member reads and taps Next, and tapping a highlighted
 * card advances the tour rather than opening that feature. Nothing is written,
 * on the server or anywhere else.
 *
 * It runs on the real Home, not a copy. Every target below renders for a member
 * who signed up a minute ago — the workout section falls back to its empty-state
 * card, calories shows a dash, coins shows zero — so there is nothing a demo
 * screen would add except a layout that drifts out of step with the real one.
 */
import { T } from '../targets';
import { TOUR, ACTIONS } from '../copy';

/**
 * @param {object} opts
 * @param {boolean} opts.hasCoach  changes only the first step's wording: a
 *   coached member picks nothing, so the freestyle line would describe
 *   something the API refuses them.
 */
export function welcomeTourSteps({ hasCoach = false } = {}) {
  const first = hasCoach ? TOUR.todayWorkoutCoached : TOUR.todayWorkoutFreestyle;

  return [
    step('A1', T.HOME_TODAY_WORKOUT, first),
    step('A2', T.HOME_CALORIES, TOUR.calories),
    step('A3', T.HOME_COINS, TOUR.coins),
    step('A4', T.HOME_CHECK_IN, TOUR.checkIn),
    // Last step hands over to the card the other three guides launch from.
    step('A5', T.HOME_GET_STARTED, TOUR.startHere, ACTIONS.done),
  ];
}

function step(id, target, { title, body }, primaryLabel = ACTIONS.next) {
  return {
    id,
    target,
    // Passive: the dim blocks everything, and a tap on the highlight advances
    // instead of opening the feature underneath.
    mode: 'passive',
    advanceOn: 'tap',
    title,
    body,
    primaryLabel,
    exitLabel: ACTIONS.skip,
  };
}
