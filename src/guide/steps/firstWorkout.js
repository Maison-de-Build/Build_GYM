/**
 * firstWorkout.js — Guide 2, in two versions.
 *
 * Freestyle members plan then log; coached members only log, because
 * self-assign is refused at the API for anyone with a trainer and Home gives
 * them no button for it. Everything from the player onwards is shared, which is
 * most of the guide — the split is three steps at the front.
 *
 * Every step runs on a demo screen, so nothing here logs a set, schedules a
 * workout or touches the member's record.
 */
import { T } from '../targets';
import { ACTIONS } from '../copy';

const CHOICE = 'GuideDemoWorkoutChoice';
const PLAYER = 'GuideDemoPlayer';
const SUMMARY = 'GuideDemoSummary';

/** The planning half — freestyle only. */
const planningSteps = [
  {
    id: 'W1', screen: CHOICE, target: T.DW_TEMPLATE_TAB,
    title: 'Two ways in',
    body: 'Use a ready-made template, or add exercises one at a time.',
  },
  {
    id: 'W2', screen: CHOICE, target: T.DW_TEMPLATE_CARD,
    title: 'Pick a template',
    body: 'Exercises, sets and targets are all set for you. Tap to choose it.',
  },
  {
    id: 'W3', screen: CHOICE, target: T.DW_SCHEDULE,
    title: 'Set it for today',
    body: 'It lands on your Home as today’s workout.',
  },
];

/** The logging half — both versions. */
const loggingSteps = [
  {
    id: 'W4', screen: PLAYER, target: T.DW_SET_FIELDS,
    title: 'Log your first set',
    body: 'Your targets are filled in. Change them to what you actually did, then mark the set done.',
  },
  {
    id: 'W5', screen: PLAYER, target: T.DW_REST,
    title: 'Rest',
    body: 'Your rest timer runs on its own. Skip it or add time here.',
    primaryLabel: ACTIONS.gotIt,
  },
  {
    id: 'W6', screen: PLAYER, target: T.DW_FINISH,
    title: 'Finish up',
    body: 'Tap Finish when you’re done with every exercise.',
  },
  {
    id: 'W7', screen: SUMMARY, target: T.DW_SUMMARY_STATS,
    title: 'Your session',
    body: 'Your numbers from what you just logged.',
  },
  {
    id: 'W8', screen: SUMMARY, target: T.DW_SUMMARY_SHARE,
    title: 'Share it',
    body: 'Post your session card anywhere you like.',
    primaryLabel: ACTIONS.done,
  },
];

export function firstWorkoutSteps({ hasCoach = false } = {}) {
  const steps = hasCoach ? loggingSteps : [...planningSteps, ...loggingSteps];
  return steps.map((step) => ({
    // Passive: the member reads, taps, and moves on. The demo screens respond
    // to the tap (a template ticks, a set is marked) but the guide decides when
    // the screen changes, so a tap can never run ahead of the tooltip.
    mode: 'passive',
    advanceOn: 'tap',
    primaryLabel: ACTIONS.next,
    exitLabel: ACTIONS.exitGuide,
    ...step,
  }));
}
