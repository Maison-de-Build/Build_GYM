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

/**
 * Step lists, keyed by guide. Each takes the member's config so the one or two
 * places a guide differs by member type are decided here rather than inside a
 * screen.
 *
 * Guides 2 to 4 land in the next stage; until then their rows are hidden by the
 * server switches, so there is nothing to launch.
 */
const BUILDERS = {
  welcome_tour: (config) => welcomeTourSteps({ hasCoach: config.hasCoach }),
};

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

    start(guideKey, steps, options);
    return true;
  }, [start, isRunning, config]);
}

/** Whether a guide has been built yet — the replay list hides the ones that haven't. */
export function isGuideImplemented(guideKey) {
  return Object.prototype.hasOwnProperty.call(BUILDERS, guideKey);
}
