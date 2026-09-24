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
import { View, Platform, StatusBar } from 'react-native';

import { useGuide } from './GuideProvider';

/**
 * measureInWindow reports from the top of the window. On Android with a
 * translucent status bar that is above the drawn content, so every rectangle
 * comes back shifted down by the status-bar height unless we take it off.
 */
const androidStatusBarOffset = () =>
  (Platform.OS === 'android' && StatusBar.currentHeight) ? StatusBar.currentHeight : 0;

export default function GuideTarget({ id, children, style, enabled = true }) {
  const { registerTarget, unregisterTarget, step, measureTick } = useGuide();
  const ref = useRef(null);
  // Avoids a measure → register → re-render → measure loop.
  const pending = useRef(false);

  const measure = useCallback(() => {
    if (!ref.current || pending.current) return;
    pending.current = true;
    ref.current.measureInWindow((x, y, width, height) => {
      pending.current = false;
      if (width > 0 && height > 0) {
        registerTarget(id, { x, y: y - androidStatusBarOffset(), width, height });
      }
    });
  }, [id, registerTarget]);

  useEffect(() => {
    if (!enabled) return undefined;
    return () => unregisterTarget(id);
  }, [id, enabled, unregisterTarget]);

  // Re-measure when this target becomes the active one. A card that scrolled,
  // or a sheet that opened over it, has moved since its last measurement.
  useEffect(() => {
    if (!enabled || step?.target !== id) return undefined;
    measure();
    // One deferred pass catches a layout that settles a frame late.
    const t = setTimeout(measure, 120);
    return () => clearTimeout(t);
  }, [enabled, step?.target, id, measure, measureTick === 0]);

  if (!enabled) return children;

  return (
    <View ref={ref} style={style} onLayout={measure} collapsable={false}>
      {children}
    </View>
  );
}
