/**
 * targets.js — the ids guides point at.
 *
 * Steps reference these and never coordinates, so a card moving around a screen
 * cannot break a guide. Both sides import from here: the screen that wraps the
 * element in <GuideTarget>, and the step list that names it. A typo then fails
 * at import rather than silently producing a step with no target.
 */
export const T = {
  // Home — every one of these renders for a brand-new member too, which is why
  // the welcome tour can run on the real screen rather than a copy of it.
  HOME_TODAY_WORKOUT: 'home.todayWorkout',
  HOME_CALORIES:      'home.calories',
  HOME_COINS:         'home.coins',
  HOME_CHECK_IN:      'home.checkIn',
  HOME_GET_STARTED:   'home.getStarted',
};
