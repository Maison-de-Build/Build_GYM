/**
 * The onboarding guide, in one import.
 *
 * Screens need two things from here: <GuideTarget id="..."> around anything a
 * guide points at, and useGuide().start(...) to launch one. Everything else is
 * wired once in App.js.
 */
export { GuideProvider, useGuide } from './GuideProvider';
export { default as GuideOverlay } from './GuideOverlay';
export { default as GuideTarget } from './GuideTarget';
export {
  useGuideStore, eligibleGuides, guideProgress, isCardExhausted,
  shouldShowCard, shouldAutoStartWelcome, workoutGuideVariant, GUIDE_KEYS,
} from './guideStore';
