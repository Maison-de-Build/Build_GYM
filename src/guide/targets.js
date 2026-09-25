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
  // Where guides 2–4 begin: the real button each feature lives behind.
  HOME_ADD_WORKOUT:   'home.addWorkout',
  HOME_ACTIVITIES:    'home.activities',
  HOME_COACH:         'home.coach',

  // ── Demo: first workout ────────────────────────────────────────────────
  DW_TEMPLATE_TAB:   'demoWorkout.templateTab',
  DW_TEMPLATE_CARD:  'demoWorkout.templateCard',
  DW_EXERCISE_TAB:   'demoWorkout.exerciseTab',
  DW_SCHEDULE:       'demoWorkout.schedule',
  DW_START:          'demoWorkout.start',
  DW_SET_FIELDS:     'demoWorkout.setFields',
  DW_LOG_SET:        'demoWorkout.logSet',
  DW_REST:           'demoWorkout.rest',
  DW_FINISH:         'demoWorkout.finish',
  DW_SUMMARY_STATS:  'demoWorkout.summaryStats',
  DW_SUMMARY_SHARE:  'demoWorkout.summaryShare',

  // ── Demo: book an activity ─────────────────────────────────────────────
  DB_LIST:           'demoBooking.list',
  DB_CARD:           'demoBooking.card',
  DB_PRICE:          'demoBooking.price',
  DB_DATE:           'demoBooking.date',
  DB_SLOT:           'demoBooking.slot',
  DB_BOOK:           'demoBooking.book',
  DB_VIEW_BOOKINGS:  'demoBooking.viewBookings',
  DB_BOOKING_CARD:   'demoBooking.bookingCard',
  DB_TXN_ROW:        'demoBooking.txnRow',

  // ── Demo: message your coach ───────────────────────────────────────────
  DC_THREAD:         'demoChat.thread',
  DC_INPUT:          'demoChat.input',
};
