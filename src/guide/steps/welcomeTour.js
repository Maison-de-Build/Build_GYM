/**
 * welcomeTour.js — Part A, the five spotlights on Home.
 *
 * Passive throughout: the member reads and taps Next on the cards, presses the
 * check-in button itself, and a tap on any highlight advances the tour rather
 * than opening that feature. Nothing is written, on the server or anywhere else.
 *
 * It runs on the real Home, not a copy. Every target below renders for a member
 * who signed up a minute ago — the workout section falls back to its empty-state
 * card, calories shows a dash, coins shows zero — so there is nothing a demo
 * screen would add except a layout that drifts out of step with the real one.
 */
import { T } from '../targets';
import { TOUR, ACTIONS, HINTS } from '../copy';
import { pressHome } from './press';

/**
 * @param {object} opts
 * @param {boolean} opts.hasCoach  changes only the first step's wording: a
 *   coached member picks nothing, so the freestyle line would describe
 *   something the API refuses them.
 */
export function welcomeTourSteps({ hasCoach = false, showCard = true } = {}) {
  const first = hasCoach ? TOUR.todayWorkoutCoached : TOUR.todayWorkoutFreestyle;

  const steps = [
    step('A1', T.HOME_TODAY_WORKOUT, first),
    step('A2', T.HOME_CALORIES, TOUR.calories),
    step('A3', T.HOME_COINS, TOUR.coins),
    // The check-in button is a button, so it is pressed rather than read past.
    // The overlay catches the press: it moves the tour on and does not open
    // check-in.
    { ...step('A4', T.HOME_CHECK_IN, TOUR.checkIn), ...pressHome(HINTS.button) },
  ];

  // The last step points at the Get started card. When the card won't show —
  // the member hid it, or finished everything on it — the tour ends at step 4,
  // as the spec says. Pointing at a card that isn't there is what produced the
  // "This didn't load" stop on a replayed tour.
  if (showCard) steps.push(step('A5', T.HOME_GET_STARTED, TOUR.startHere));

  // The last card step reads Done. A button step keeps no label at all — when
  // the card is hidden the tour ends on the check-in press.
  const last = steps[steps.length - 1];
  if (last.primaryLabel) last.primaryLabel = ACTIONS.done;
  return steps;
}

function step(id, target, { title, body }, primaryLabel = ACTIONS.next) {
  return {
    id,
    target,
    screen: 'MainTabs',
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
