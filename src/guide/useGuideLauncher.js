/**
 * useGuideLauncher.js — one way to start a guide, wherever it's launched from.
 *
 * The Get started card on Home and the replay list in Profile both call this,
 * so a replay is identical to a first run by construction rather than by two
 * call sites agreeing to build the same step list.
 */
import { useCallback } from 'react';

import { useGuide } from './GuideProvider';
import { useGuideStore } from './guideStore';
import { welcomeTourSteps } from './steps/welcomeTour';
import { firstWorkoutSteps } from './steps/firstWorkout';
import { bookingPracticeSteps } from './steps/bookingPractice';
import { coachChatSteps } from './steps/coachChat';
import { useDemoBooking, seedDemoBooking } from './demo/demoBookingState';

/**
 * Step lists, keyed by guide. Each takes the member's config so the one or two
 * places a guide differs by member type are decided here rather than inside a
 * screen.
 */
const BUILDERS = {
  welcome_tour:     (config) => welcomeTourSteps({ hasCoach: config.hasCoach }),
  first_workout:    (config) => firstWorkoutSteps({ hasCoach: config.hasCoach }),
  booking_practice: () => bookingPracticeSteps(),
  coach_chat:       () => coachChatSteps(),
};

/** Guides that keep in-memory demo state needing a clean slate each run. */
const RESETS_DEMO_BOOKING = new Set(['booking_practice']);

export function useGuideLauncher() {
  const { start, isRunning } = useGuide();
  const config = useGuideStore((s) => s.config);

  return useCallback((guideKey, options = {}) => {
    // Launching over a running guide would leave the first one's status
    // unrecorded and its targets in the map.
    if (isRunning) return false;

    const build = BUILDERS[guideKey];
    if (!build) return false;

    const steps = build(config);
    if (!steps?.length) return false;

    // A replay must look exactly like a first run, so the practice booking
    // starts from a full balance with nothing booked every time.
    if (RESETS_DEMO_BOOKING.has(guideKey)) seedDemoBooking();

    start(guideKey, steps, {
      ...options,
      onDone: (status) => {
        // Practice data is memory-only and goes the moment the guide ends,
        // however it ended — finished, skipped or backed out of.
        if (RESETS_DEMO_BOOKING.has(guideKey)) useDemoBooking.getState().reset();
        options.onDone?.(status);
      },
    });
    return true;
  }, [start, isRunning, config]);
}

/** Whether a guide has been built yet — the replay list hides the ones that haven't. */
export function isGuideImplemented(guideKey) {
  return Object.prototype.hasOwnProperty.call(BUILDERS, guideKey);
}
