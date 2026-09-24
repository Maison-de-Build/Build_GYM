/**
 * guideRules.js — the rules about guides, with no dependencies.
 *
 * Kept apart from guideStore so they can be unit tested: the store pulls in
 * zustand and, through the service, the axios client and @env, none of which
 * load in a plain node test run.
 *
 * Everything that decides which rows exist lives here, so Home's Get started
 * card and Profile's replay list can never disagree about them.
 */

/** The three guides launched from the card, in the order they appear. */
export const GUIDE_KEYS = ['first_workout', 'booking_practice', 'coach_chat'];

/** Mirrors the server's default so the UI renders before the first fetch. */
export const DEFAULT_STATE = {
  version: 1,
  welcome_tour: 'not_started',
  card_dismissed: false,
  guides: {
    first_workout: { status: 'not_started' },
    booking_practice: { status: 'not_started' },
    coach_chat: { status: 'not_started' },
  },
  updated_at: null,
};

/**
 * Everything off until the server says otherwise.
 *
 * A failed config fetch must not start a guide: running one we were told to
 * switch off is worse than running none, and the member can still replay from
 * Profile once the call succeeds.
 */
export const DEFAULT_CONFIG = {
  welcome: false,
  firstWorkout: false,
  bookingPractice: false,
  coachChat: false,
  doItForReal: false,
  hasCoach: false,
  isTestAccount: false,
};

/** Guides this member is eligible for, in card order. */
export function eligibleGuides(config = DEFAULT_CONFIG) {
  const rows = [];
  if (config.firstWorkout) rows.push('first_workout');
  if (config.bookingPractice) rows.push('booking_practice');
  // The coach row only exists when there is a coach to message.
  if (config.coachChat && config.hasCoach) rows.push('coach_chat');
  return rows;
}

/** "1 of 3 done" for the Get started card. */
export function guideProgress(state = DEFAULT_STATE, config = DEFAULT_CONFIG) {
  const rows = eligibleGuides(config);
  const done = rows.filter((k) => state.guides?.[k]?.status && state.guides[k].status !== 'not_started').length;
  return { done, total: rows.length };
}

/** Whether the card has anything left to offer. */
export function isCardExhausted(state = DEFAULT_STATE, config = DEFAULT_CONFIG) {
  const rows = eligibleGuides(config);
  if (rows.length === 0) return true;
  return rows.every((k) => state.guides?.[k]?.status && state.guides[k].status !== 'not_started');
}

/**
 * Whether the Get started card renders at all.
 *
 * Hidden once the member dismisses it, and once every row is dealt with. A
 * member with no eligible guides — every switch off — never sees it either.
 */
export function shouldShowCard(state = DEFAULT_STATE, config = DEFAULT_CONFIG) {
  if (state.card_dismissed) return false;
  return !isCardExhausted(state, config);
}

/**
 * Whether the welcome tour should start on this Home render.
 *
 * Only on a member who has never seen it, and only while the switch is on. A
 * skipped tour never restarts on its own — it lives in Profile from then on.
 */
export function shouldAutoStartWelcome(state = DEFAULT_STATE, config = DEFAULT_CONFIG) {
  return !!config.welcome && state.welcome_tour === 'not_started';
}

/**
 * Which workout guide a member gets.
 *
 * A coached member cannot plan a workout — the API refuses it and the app gives
 * them no button for it — so their guide starts at the player instead of at
 * planning. One flag decides it, the same one that decides the coach row.
 */
export function workoutGuideVariant(config = DEFAULT_CONFIG) {
  return config.hasCoach ? 'coached' : 'freestyle';
}

/** Local mirror of the server's merge, for the optimistic hop before the PATCH. */
export function mergeLocalState(state = DEFAULT_STATE, partial = {}) {
  const next = { ...state, guides: { ...state.guides } };
  if (typeof partial.welcome_tour === 'string') next.welcome_tour = partial.welcome_tour;
  if (typeof partial.card_dismissed === 'boolean') next.card_dismissed = partial.card_dismissed;
  for (const [key, value] of Object.entries(partial.guides || {})) {
    if (next.guides[key] && typeof value?.status === 'string') {
      next.guides[key] = { ...next.guides[key], status: value.status };
    }
  }
  return next;
}
