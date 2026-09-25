/**
 * GuideProvider.js — the one engine every guide runs on.
 *
 * A guide is a list of steps. This holds which one is showing, where its target
 * is on screen, and how the member gets to the next one. Screens contribute
 * nothing but a <GuideTarget id="..."> wrapper; no screen contains guide logic.
 *
 * Every step names the screen it lives on. That is what lets the engine notice
 * when the member has been taken somewhere else mid-guide — a notification, the
 * phone's back button, a tap that got through — and step aside instead of
 * leaving an overlay over a screen where its target does not exist.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { BackHandler } from 'react-native';
import { CommonActions } from '@react-navigation/native';

import { navigationRef } from '../navigation/navigationRef';
import { useGuideStore } from './guideStore';
import { buildReturnRoutes, pruneDemoRoutes, snapshotNames } from './guideNav';

// Two contexts on purpose. Measurements land on every scroll frame; if they
// lived in the same context as the session, every screen reading the session —
// Home included — would re-render sixty times a second while it scrolled.
const GuideContext = createContext(null);
const GuideMeasureContext = createContext(null);

/** How long a step waits for its target before offering Try again / exit. */
export const TARGET_TIMEOUT_MS = 5000;

/** How long an optional step waits before quietly moving on. */
export const OPTIONAL_TIMEOUT_MS = 1500;

export function GuideProvider({ children }) {
  // { guideKey, steps, index, onDone, returnStack } — null when nothing runs.
  const [session, setSession] = useState(null);
  // The controls act on the live session through this rather than through a
  // setSession updater: ending a guide is a side effect, and one inside an
  // updater that returns its input unchanged is silently dropped.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // id → { x, y, width, height }. A ref, not state: measurement fires often.
  const targetsRef = useRef(new Map());
  const [measureTick, setMeasureTick] = useState(0);
  // Each target parks its own measure fn here, so a scrolling screen can ask the
  // active one to re-measure without knowing which target that is.
  const measurersRef = useRef(new Map());

  const markGuide = useGuideStore((s) => s.markGuide);
  const setWelcomeTour = useGuideStore((s) => s.setWelcomeTour);

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

  const clearSession = () => {
    sessionRef.current = null;
    targetsRef.current.clear();
    setSession(null);
  };

  /**
   * End a guide the member finished or skipped: record it, and put them back on
   * the stack they launched it from — the whole stack, not just its top screen,
   * so back works normally afterwards.
   */
  const stop = useCallback((cur, status) => {
    clearSession();
    recordOutcome(cur.guideKey, status);
    resetTo(buildReturnRoutes(rootRoutes(), cur.returnStack));
    cur.onDone?.(status);
  }, [recordOutcome]);

  /**
   * Step aside without recording anything. Used when something other than the
   * guide took the member off its screen. They stay where they went; only the
   * practice screens underneath are removed.
   */
  const abandon = useCallback(() => {
    const cur = sessionRef.current;
    if (!cur) return;
    clearSession();
    const routes = rootRoutes();
    const pruned = pruneDemoRoutes(routes);
    if (pruned.length !== routes.length) resetTo(pruned);
    cur.onDone?.('abandoned');
  }, []);

  /**
   * Begin a guide. `returnStack` is where to land when it ends, bottom first;
   * without one the guide returns to the stack it was launched from.
   */
  const start = useCallback((guideKey, steps, options = {}) => {
    if (!steps?.length) return;
    const s = {
      guideKey,
      steps,
      index: 0,
      onDone: options.onDone,
      returnStack: options.returnStack || snapshotNames(rootRoutes()),
    };
    targetsRef.current.clear();
    sessionRef.current = s;
    setSession(s);
    const first = steps[0];
    if (first.screen && currentRouteName() !== first.screen) navigateTo(first.screen, first.params);
  }, []);

  const moveTo = useCallback((nextIndex) => {
    const cur = sessionRef.current;
    if (!cur) return;
    if (nextIndex >= cur.steps.length) { stop(cur, 'completed'); return; }
    const nextStep = cur.steps[nextIndex];
    const updated = { ...cur, index: nextIndex };
    // Updated before navigating, so the route listener below already expects the
    // new screen when the navigation lands and doesn't mistake it for a detour.
    sessionRef.current = updated;
    if (nextStep.screen && nextStep.screen !== cur.steps[cur.index].screen) {
      targetsRef.current.clear();
      navigateTo(nextStep.screen, nextStep.params);
    }
    setSession(updated);
  }, [stop]);

  const next = useCallback(() => {
    const cur = sessionRef.current;
    if (cur) moveTo(cur.index + 1);
  }, [moveTo]);

  const goToIndex = useCallback((i) => moveTo(i), [moveTo]);

  const finish = useCallback(() => {
    const cur = sessionRef.current;
    if (cur) stop(cur, 'completed');
  }, [stop]);

  /** Skip / Exit guide. Ends the guidance only — it never undoes anything. */
  const exit = useCallback(() => {
    const cur = sessionRef.current;
    if (cur) stop(cur, 'skipped');
  }, [stop]);

  const guideKey = session ? session.guideKey : null;

  // The phone's back button during a guide is Skip, as the spec says. Without
  // this it popped the screen underneath while the overlay stayed put, pointing
  // at a target on a screen that had just gone.
  useEffect(() => {
    if (!guideKey) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      exit();
      return true;
    });
    return () => sub.remove();
  }, [guideKey, exit]);

  // If anything other than the guide takes the member off the step's screen,
  // step aside. This is what stops a guide carrying on invisibly — the state
  // behind "nothing responds": a running guide refuses to launch another one.
  useEffect(() => {
    if (!guideKey) return undefined;
    return navigationRef.addListener('state', () => {
      const cur = sessionRef.current;
      if (!cur) return;
      const expected = cur.steps[cur.index]?.screen;
      const route = currentRouteName();
      if (expected && route && route !== expected) abandon();
    });
  }, [guideKey, abandon]);

  const step = session ? session.steps[session.index] : null;
  const stepRef = useRef(step);
  stepRef.current = step;

  /** Re-measure whatever the current step points at. Called on scroll frames. */
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
    registerTarget,
    unregisterTarget,
    registerMeasurer,
    remeasureActive,
    start,
    next,
    goToIndex,
    finish,
    exit,
  }), [session, step, registerTarget, unregisterTarget, registerMeasurer,
    remeasureActive, start, next, goToIndex, finish, exit]);

  const measureValue = useMemo(
    () => ({ targets: targetsRef.current, measureTick }),
    [measureTick],
  );

  return (
    <GuideContext.Provider value={value}>
      <GuideMeasureContext.Provider value={measureValue}>
        {children}
      </GuideMeasureContext.Provider>
    </GuideContext.Provider>
  );
}

export function useGuide() {
  const ctx = useContext(GuideContext);
  if (!ctx) throw new Error('useGuide must be used inside <GuideProvider>');
  return ctx;
}

/** Measurements — for the overlay only, so nothing else re-renders on scroll. */
export function useGuideMeasure() {
  const ctx = useContext(GuideMeasureContext);
  if (!ctx) throw new Error('useGuideMeasure must be used inside <GuideProvider>');
  return ctx;
}

function rootRoutes() {
  return navigationRef.isReady() ? (navigationRef.getRootState()?.routes || []) : [];
}

function currentRouteName() {
  return navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : null;
}

function resetTo(routes) {
  if (!navigationRef.isReady() || !routes?.length) return;
  navigationRef.dispatch(CommonActions.reset({ index: routes.length - 1, routes }));
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
