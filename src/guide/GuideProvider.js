/**
 * GuideProvider.js — the one engine every guide runs on.
 *
 * A guide is a list of steps. This holds which one is showing, where its target
 * is on screen, and how the member gets to the next one. Screens contribute
 * nothing but a <GuideTarget id="..."> wrapper; no screen contains guide logic.
 *
 * Because every guide runs on demo screens we build, targets mount with the
 * screen and never wait on a fetch. The 5-second fallback below is still here —
 * a step whose target never registers must offer a way out rather than leave
 * the member under a dim layer with nothing to tap.
 */
import React, {
  createContext, useCallback, useContext, useMemo, useRef, useState,
} from 'react';

import { navigationRef } from '../navigation/navigationRef';
import { useGuideStore } from './guideStore';

const GuideContext = createContext(null);

/** How long a step waits for its target before offering Try again / exit. */
export const TARGET_TIMEOUT_MS = 5000;

export function GuideProvider({ children }) {
  // { guideKey, steps, index, onDone } — null when no guide is running.
  const [session, setSession] = useState(null);
  // id → { x, y, width, height }. A ref, not state: measurement fires often and
  // re-rendering the whole tree on every layout pass would fight the animation.
  const targetsRef = useRef(new Map());
  // Bumped when a measurement lands, so the overlay alone re-reads the map.
  const [measureTick, setMeasureTick] = useState(0);

  const markGuide = useGuideStore((s) => s.markGuide);
  const setWelcomeTour = useGuideStore((s) => s.setWelcomeTour);

  // Each target parks its own measure fn here, so a screen that scrolls can ask
  // the active one to re-measure without knowing which target that is.
  const measurersRef = useRef(new Map());

  const registerMeasurer = useCallback((id, fn) => {
    if (fn) measurersRef.current.set(id, fn);
    else measurersRef.current.delete(id);
  }, []);

  const registerTarget = useCallback((id, rect) => {
    const prev = targetsRef.current.get(id);
    if (prev && sameRect(prev, rect)) return;
    targetsRef.current.set(id, rect);
    setMeasureTick((t) => t + 1);
  }, []);

  const unregisterTarget = useCallback((id) => {
    if (!targetsRef.current.delete(id)) return;
    setMeasureTick((t) => t + 1);
  }, []);

  /** Record how a guide ended. The welcome tour is stored on its own field. */
  const recordOutcome = useCallback((guideKey, status) => {
    if (guideKey === 'welcome_tour') setWelcomeTour(status);
    else markGuide(guideKey, status);
  }, [markGuide, setWelcomeTour]);

  /**
   * End a guide: record how it went, drop every measurement, and put the member
   * back where they launched it from.
   *
   * That last part is what makes the demo screens safe to leave at any point.
   * A guide can walk several screens deep into its own stack, so exiting from
   * the middle has to unwind all of it — otherwise the member taps back out of
   * a demo booking into a demo activity list with no guide running.
   */
  const stop = useCallback((guideKey, status, onDone, returnTo) => {
    recordOutcome(guideKey, status);
    targetsRef.current.clear();
    setSession(null);
    if (returnTo && navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: returnTo }] });
    }
    onDone?.(status);
  }, [recordOutcome]);

  /**
   * Begin a guide. `steps` is the whole list up front — no step is computed
   * from live data, which is what lets a replay be identical to a first run.
   */
  const start = useCallback((guideKey, steps, options = {}) => {
    if (!steps?.length) return;
    targetsRef.current.clear();
    const returnTo = options.returnTo
      || (navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : null);
    setSession({ guideKey, steps, index: 0, onDone: options.onDone, returnTo });
    const first = steps[0];
    if (first.screen) navigateTo(first.screen, first.params);
  }, []);

  const goToIndex = useCallback((nextIndex) => {
    setSession((cur) => {
      if (!cur) return cur;
      if (nextIndex >= cur.steps.length) return cur; // finish() handles the end
      const step = cur.steps[nextIndex];
      // Changing screens invalidates every measurement taken on the old one.
      if (step.screen && step.screen !== cur.steps[cur.index].screen) {
        targetsRef.current.clear();
        navigateTo(step.screen, step.params);
      }
      return { ...cur, index: nextIndex };
    });
  }, []);

  const finish = useCallback(() => {
    setSession((cur) => {
      if (cur) stop(cur.guideKey, 'completed', cur.onDone, cur.returnTo);
      return cur;
    });
  }, [stop]);

  const next = useCallback(() => {
    setSession((cur) => {
      if (!cur) return cur;
      const nextIndex = cur.index + 1;
      if (nextIndex >= cur.steps.length) {
        stop(cur.guideKey, 'completed', cur.onDone, cur.returnTo);
        return cur;
      }
      const step = cur.steps[nextIndex];
      if (step.screen && step.screen !== cur.steps[cur.index].screen) {
        targetsRef.current.clear();
        navigateTo(step.screen, step.params);
      }
      return { ...cur, index: nextIndex };
    });
  }, [stop]);

  /** Skip / Exit guide. Ends the guidance only — it never undoes anything. */
  const exit = useCallback(() => {
    setSession((cur) => {
      if (cur) stop(cur.guideKey, 'skipped', cur.onDone, cur.returnTo);
      return cur;
    });
  }, [stop]);

  const step = session ? session.steps[session.index] : null;
  // Read inside remeasureActive, which must not be rebuilt on every step or the
  // scroll handler it is wired into would be re-subscribed constantly.
  const stepRef = useRef(step);
  stepRef.current = step;

  /**
   * Re-measure whatever the current step points at.
   *
   * Called on every scroll frame by screens that scroll. Timers alone were not
   * enough: a scroll animation finishing later than the timer left the cutout
   * drawn at the target's old position, which is worse than no highlight —
   * it points confidently at the wrong thing.
   */
  const remeasureActive = useCallback(() => {
    const target = stepRef.current?.target;
    if (target) measurersRef.current.get(target)?.();
  }, []);

  const value = useMemo(() => ({
    session,
    step,
    stepNumber: session ? session.index + 1 : 0,
    stepCount: session ? session.steps.length : 0,
    isRunning: !!session,
    targets: targetsRef.current,
    measureTick,
    registerTarget,
    unregisterTarget,
    registerMeasurer,
    remeasureActive,
    start,
    next,
    goToIndex,
    finish,
    exit,
  }), [session, step, measureTick, registerTarget, unregisterTarget, registerMeasurer,
    remeasureActive, start, next, goToIndex, finish, exit]);

  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>;
}

export function useGuide() {
  const ctx = useContext(GuideContext);
  if (!ctx) throw new Error('useGuide must be used inside <GuideProvider>');
  return ctx;
}

/** Safe to call before the navigator is ready — the first step waits for mount. */
function navigateTo(screen, params) {
  if (navigationRef.isReady()) navigationRef.navigate(screen, params);
}

/** Sub-pixel jitter on every layout pass would re-render the overlay forever. */
function sameRect(a, b) {
  return Math.abs(a.x - b.x) < 1
    && Math.abs(a.y - b.y) < 1
    && Math.abs(a.width - b.width) < 1
    && Math.abs(a.height - b.height) < 1;
}
