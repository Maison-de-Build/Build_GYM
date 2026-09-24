/**
 * guideStore.js — what the app knows about the onboarding guides.
 *
 * Two things live here: the server's switches (which guides are on, whether
 * this member has a coach, whether they're a test account) and the member's
 * progress. The server is the truth — there is no local cache to reconcile,
 * because a guide is a single sitting on demo screens and losing its progress
 * costs the member nothing but a replay.
 *
 * That is why the original spec's AsyncStorage layer is absent: it existed so a
 * part-finished REAL workout survived a reinstall. Nothing here is worth it.
 *
 * The rules about which rows exist live in guideRules.js, which has no imports
 * and is unit tested.
 */
import { create } from 'zustand';

import {
  fetchGuideConfig, fetchGuideState, patchGuideState, resetGuideState,
} from './guideService';
import { DEFAULT_STATE, DEFAULT_CONFIG, mergeLocalState } from './guideRules';

export const useGuideStore = create((set, get) => ({
  config: DEFAULT_CONFIG,
  state: DEFAULT_STATE,
  loaded: false,

  /** Called on login, on app start and whenever the app returns to the front. */
  load: async () => {
    try {
      const [config, state] = await Promise.all([fetchGuideConfig(), fetchGuideState()]);
      set({
        config: { ...DEFAULT_CONFIG, ...config },
        state: { ...DEFAULT_STATE, ...state },
        loaded: true,
      });
    } catch {
      // Offline or a 500: keep what we had and mark loaded so the UI stops
      // waiting. With no successful fetch the defaults leave every guide off.
      set({ loaded: true });
    }
  },

  /**
   * Optimistic write. The row is worth so little that a failed PATCH is not
   * worth surfacing or retrying — the member sees the guide as done either way,
   * and the next successful load reconciles it.
   */
  patch: async (partial) => {
    set({ state: mergeLocalState(get().state, partial) });
    try {
      const saved = await patchGuideState(partial);
      set({ state: { ...DEFAULT_STATE, ...saved } });
    } catch { /* keep the optimistic value */ }
  },

  markGuide: (key, status) => get().patch({ guides: { [key]: { status } } }),
  setWelcomeTour: (status) => get().patch({ welcome_tour: status }),
  dismissCard: () => get().patch({ card_dismissed: true }),

  /** Profile > Reset guides. The server 403s anyone not on the test list. */
  reset: async () => {
    const fresh = await resetGuideState();
    set({ state: { ...DEFAULT_STATE, ...fresh } });
  },

  /** Drop everything on logout so the next member never sees the last one's. */
  clear: () => set({ config: DEFAULT_CONFIG, state: DEFAULT_STATE, loaded: false }),
}));

export {
  eligibleGuides, guideProgress, isCardExhausted,
  shouldShowCard, shouldAutoStartWelcome, workoutGuideVariant, GUIDE_KEYS,
} from './guideRules';
