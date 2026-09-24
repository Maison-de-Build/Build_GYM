/**
 * GuideTarget.js — the only thing a screen has to add for the guide to work.
 *
 *   <GuideTarget id="home.todayWorkout"><TodayCard /></GuideTarget>
 *
 * It measures its child in window coordinates and hands the rectangle to the
 * provider. Steps name these ids and never coordinates, so moving a card around
 * a screen can't break a guide — only renaming or deleting its id can, and that
 * shows up as the 5-second fallback rather than a wrong highlight.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { View, Dimensions, Platform, StatusBar } from 'react-native';

import { useGuide } from './GuideProvider';

/**
 * measureInWindow reports relative to the app window, which on Android starts
 * below the status bar (dumpsys: app=1344x2920 inside cur=1344x2992). The
 * overlay is an absoluteFill spanning the whole screen, so every rectangle has
 * to be moved down by that gap to line up with what the member sees.
 */
const statusBarOffset = () =>
  (Platform.OS === 'android' && StatusBar.currentHeight) ? StatusBar.currentHeight : 0;

export default function GuideTarget({ id, children, style, enabled = true, scrollRef, scrollOffsetRef }) {
  const { registerTarget, unregisterTarget, registerMeasurer, step, measureTick } = useGuide();
  const ref = useRef(null);
  // One measurement in flight at a time, but a request that arrives while one is
  // running is remembered rather than dropped. Scroll fires far faster than
  // measureInWindow answers, so dropping meant the LAST frame of a scroll — the
  // one that matters — was routinely lost, leaving the cutout at the position
  // the target had partway through the animation.
  const pending = useRef(false);
  const queued = useRef(false);

  const measure = useCallback(() => {
    if (!ref.current) return;
    if (pending.current) { queued.current = true; return; }
    pending.current = true;
    ref.current.measureInWindow((x, y, width, height) => {
      pending.current = false;
      if (width > 0 && height > 0) {
        registerTarget(id, { x, y: y + statusBarOffset(), width, height });
      }
      if (queued.current) {
        queued.current = false;
        measure();
      }
    });
  }, [id, registerTarget]);

  /**
   * Bring the target into view before measuring it.
   *
   * Home is longer than the screen, so its first spotlight target sits below
   * the fold on a fresh install — the cutout gets measured correctly and then
   * drawn half off the bottom. Scrolling first is the only way the highlight
   * lands on something the member can actually see.
   *
   * Worked out from window coordinates plus the scroll offset rather than
   * measureLayout. Under the new architecture measureLayout given a numeric
   * node handle fails silently, so the scroll simply never happened — no error,
   * no movement. Window coordinates behave the same on both architectures.
   */
  const scrollIntoView = useCallback(() => {
    const scroller = scrollRef?.current;
    if (!scroller || !ref.current) return false;

    return new Promise((resolve) => {
      ref.current.measureInWindow((_x, y, _w, height) => {
        const winH = Dimensions.get('window').height;
        const top = y + statusBarOffset();
        const bottom = top + height;
        // Room kept below the target for the tooltip, and above it for the
        // header the guide never covers.
        const SAFE_BOTTOM = 260;
        const SAFE_TOP = 120;
        const offset = scrollOffsetRef?.current ?? 0;

        let delta = 0;
        if (bottom > winH - SAFE_BOTTOM) delta = bottom - (winH - SAFE_BOTTOM);
        else if (top < SAFE_TOP) delta = top - SAFE_TOP;

        // A target already comfortably in view is left alone: scrolling it
        // anyway would shift the page under a member who can already see it.
        if (Math.abs(delta) < 8) { resolve(false); return; }

        scroller.scrollTo({ y: Math.max(0, offset + delta), animated: true });
        resolve(true);
      });
    });
  }, [scrollRef, scrollOffsetRef]);

  useEffect(() => {
    if (!enabled) return undefined;
    registerMeasurer(id, measure);
    return () => { registerMeasurer(id, null); unregisterTarget(id); };
  }, [id, enabled, unregisterTarget, registerMeasurer, measure]);

  // Re-measure when this target becomes the active one. A card that scrolled,
  // or a sheet that opened over it, has moved since its last measurement.
  useEffect(() => {
    if (!enabled || step?.target !== id) return undefined;
    const timers = [];
    // Measure once up front so a target already in view highlights immediately,
    // then again as the screen settles. The later passes are not only for
    // scrolling: a screen whose header resolves a frame late (the demo screens
    // size their banner from the safe-area inset) shifts its content down after
    // the first measurement, and nothing else would correct it — those screens
    // have no scroll to drive a re-measure.
    measure();
    [120, 350, 700].forEach((ms) => timers.push(setTimeout(measure, ms)));
    Promise.resolve(scrollIntoView()).then((scrolled) => {
      if (scrolled) timers.push(setTimeout(measure, 1000));
    });
    return () => timers.forEach(clearTimeout);
  }, [enabled, step?.target, id, measure, scrollIntoView]);

  if (!enabled) return children;

  return (
    <View ref={ref} style={style} onLayout={measure} collapsable={false}>
      {children}
    </View>
  );
}
