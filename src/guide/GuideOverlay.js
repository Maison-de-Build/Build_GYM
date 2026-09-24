/**
 * GuideOverlay.js — the dim, the cutout and the tooltip.
 *
 * Mounted once at the root, above the navigation container, so one instance
 * serves every guide on every screen.
 *
 * The dim is drawn in SVG and takes no touches at all; blocking is done by four
 * plain Views laid around the cutout. Doing it the other way — one full-screen
 * touch catcher with a transparent hole — does not work, because a hole in a
 * view still swallows the tap. Four blockers leave the target genuinely
 * untouched, so the element underneath receives a real press.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
  AccessibilityInfo, Easing, ScrollView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Mask, Rect, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

// The cutout slides between targets, so its geometry is animated rather than
// re-rendered. Native driver is off: these are SVG layout props, not transforms.
const AnimatedRect = Animated.createAnimatedComponent(Rect);

import { MC, MG, MF, MR } from '../theme/mdbKit';
import { useGuide, TARGET_TIMEOUT_MS } from './GuideProvider';
import { DEMO_BANNER } from './copy';
import PracticeBanner from './demo/PracticeBanner';

// Which guides run on demo screens, and what their banner says. The welcome
// tour runs on the real Home and has none.
const DEMO_BANNERS = {
  first_workout: DEMO_BANNER.workout,
  booking_practice: DEMO_BANNER.booking,
  coach_chat: DEMO_BANNER.chat,
};

const DIM_COLOR = '#08060B';
const DIM_OPACITY = 0.85;
const CUTOUT_PAD = 8;
const CUTOUT_RADIUS = 12;
const RING_WIDTH = 1.5;
const TOOLTIP_MAX_W = 320;
const TOOLTIP_GAP = 12;
const FADE_MS = 200;
// Height of the practice banner's text row below the safe-area inset: 8 top
// padding + ~16 line + 8 bottom.
const BANNER_H = 34;
const SLIDE_MS = 250;

export default function GuideOverlay() {
  const { session, step, stepNumber, stepCount, targets, measureTick, next, exit, isRunning } = useGuide();
  const insets = useSafeAreaInsets();
  const { width: SW, height: SH } = Dimensions.get('window');

  const [reduceMotion, setReduceMotion] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [tooltipH, setTooltipH] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  // Cutout geometry, animated so it slides from one target to the next.
  const geo = useRef({
    x: new Animated.Value(0), y: new Animated.Value(0),
    w: new Animated.Value(0), h: new Animated.Value(0),
  }).current;
  const hasCutout = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const rect = step?.target ? targets.get(step.target) : null;
  // Recomputed whenever a measurement lands.
  const cutout = useMemo(() => {
    if (!rect) return null;
    return {
      x: Math.max(0, rect.x - CUTOUT_PAD),
      y: Math.max(0, rect.y - CUTOUT_PAD),
      width: Math.min(SW, rect.width + CUTOUT_PAD * 2),
      height: rect.height + CUTOUT_PAD * 2,
    };
  }, [rect, SW, measureTick]);

  // A step with no target at all (an intro or hand-off card) is centred.
  const centred = !!step && !step.target;

  useEffect(() => {
    if (!isRunning) { fade.setValue(0); return undefined; }
    Animated.timing(fade, {
      toValue: 1, duration: FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start();
    return undefined;
  }, [isRunning, fade]);

  // Reset the "didn't load" timer on every step. On demo screens the target is
  // always there, so this should never fire — but a step that leaves the member
  // under a dim layer with nothing to tap is the one failure we cannot ship.
  useEffect(() => {
    if (!step || centred) { setTimedOut(false); return undefined; }
    setTimedOut(false);
    const t = setTimeout(() => setTimedOut(true), TARGET_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [step?.id, centred]);

  useEffect(() => { if (cutout) setTimedOut(false); }, [cutout]);

  // Slide to the new target. The first cutout of a guide, and every cutout when
  // Reduce Motion is on, is placed outright — sliding in from a corner that was
  // never a target reads as a glitch rather than as movement.
  useEffect(() => {
    if (!cutout) { hasCutout.current = false; return undefined; }
    const to = { x: cutout.x, y: cutout.y, w: cutout.width, h: cutout.height };
    if (!hasCutout.current || reduceMotion) {
      hasCutout.current = true;
      geo.x.setValue(to.x); geo.y.setValue(to.y);
      geo.w.setValue(to.w); geo.h.setValue(to.h);
      return undefined;
    }
    const anim = Animated.parallel(
      [['x', to.x], ['y', to.y], ['w', to.w], ['h', to.h]].map(([key, value]) =>
        Animated.timing(geo[key], {
          toValue: value, duration: SLIDE_MS,
          easing: Easing.inOut(Easing.quad), useNativeDriver: false,
        })),
    );
    anim.start();
    return () => anim.stop();
  }, [cutout, reduceMotion, geo]);

  const handlePrimary = useCallback(() => next(), [next]);

  if (!isRunning || !step) return null;

  const ready = centred || !!cutout;
  const showFallback = !ready && timedOut;
  // Until the target is measured (a frame or two) draw nothing rather than a
  // dim layer with the cutout in the wrong place.
  if (!ready && !showFallback) return null;

  const exitLabel = step.exitLabel || 'Skip';
  const demoBanner = DEMO_BANNERS[session?.guideKey];
  const placement = pickPlacement({ cutout, tooltipH, SH, insets, centred: centred || showFallback });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]} pointerEvents="box-none">
      {/* ── Dim + cutout. Visual only; never receives a touch. ───────────── */}
      <Svg width={SW} height={SH} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Mask id="guide-cut">
            <Rect x="0" y="0" width={SW} height={SH} fill="#fff" />
            {cutout && (
              <AnimatedRect
                x={geo.x} y={geo.y} width={geo.w} height={geo.h}
                rx={CUTOUT_RADIUS} ry={CUTOUT_RADIUS} fill="#000"
              />
            )}
          </Mask>
          <SvgGradient id="guide-ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={MC.violet} />
            <Stop offset="1" stopColor={MC.cyan} />
          </SvgGradient>
        </Defs>

        <Rect
          x="0" y="0" width={SW} height={SH}
          fill={DIM_COLOR} opacity={DIM_OPACITY} mask="url(#guide-cut)"
        />

        {cutout && (
          <AnimatedRect
            x={geo.x} y={geo.y} width={geo.w} height={geo.h}
            rx={CUTOUT_RADIUS} ry={CUTOUT_RADIUS}
            fill="none" stroke="url(#guide-ring)" strokeWidth={RING_WIDTH}
          />
        )}
      </Svg>

      {/* ── Touch blockers: four panels around the cutout. ───────────────── */}
      {cutout ? (
        <>
          <Blocker style={{ top: 0, left: 0, right: 0, height: cutout.y }} />
          <Blocker style={{ top: cutout.y + cutout.height, left: 0, right: 0, bottom: 0 }} />
          <Blocker style={{ top: cutout.y, left: 0, width: cutout.x, height: cutout.height }} />
          <Blocker style={{
            top: cutout.y, left: cutout.x + cutout.width, right: 0, height: cutout.height,
          }} />
          {/* Passive steps show the feature without opening it: the tap lands
              here, advances, and never reaches the element underneath. */}
          {step.mode === 'passive' && (
            <TouchableOpacity
              activeOpacity={1}
              onPress={step.advanceOn === 'tap' ? handlePrimary : undefined}
              style={{
                position: 'absolute',
                top: cutout.y, left: cutout.x, width: cutout.width, height: cutout.height,
              }}
            />
          )}
        </>
      ) : (
        <Blocker style={StyleSheet.absoluteFillObject} />
      )}

      {/* ── Practice banner, redrawn above the dim. ─────────────────────── */}
      {/* The demo screen draws this too, but underneath an 85% dim it is the
          one thing on screen that must never be hard to read. */}
      {!!demoBanner && (
        <View style={s.bannerSlot} pointerEvents="none">
          <PracticeBanner label={demoBanner} />
        </View>
      )}

      {/* ── Exit control, top-right under the safe area. ─────────────────── */}
      {/* Clear of the practice banner when there is one, so the way out is
          never tucked behind it. */}
      <TouchableOpacity
        style={[s.exit, { top: insets.top + 8 + (demoBanner ? BANNER_H : 0) }]}
        onPress={exit}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={exitLabel}
      >
        <Text style={s.exitText}>{exitLabel}</Text>
      </TouchableOpacity>

      {/* ── Tooltip ─────────────────────────────────────────────────────── */}
      <View
        style={[s.tooltipWrap, placement.style]}
        onLayout={(e) => setTooltipH(e.nativeEvent.layout.height)}
        accessibilityViewIsModal
      >
        <View style={s.tooltip}>
          {showFallback ? (
            <>
              <Text style={s.title} accessibilityRole="header">This didn't load</Text>
              <Text style={s.body}>Try again, or exit the guide.</Text>
              <View style={s.buttonRow}>
                <TouchableOpacity onPress={exit} style={s.secondaryBtn}>
                  <Text style={s.secondaryText}>{exitLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTimedOut(false)} activeOpacity={0.9}>
                  <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.primaryBtn}>
                    <Text style={s.primaryText}>Try again</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {!step.hideProgress && stepCount > 1 && (
                <Text style={s.progress}>{stepNumber} of {stepCount}</Text>
              )}
              <Text style={s.title} accessibilityRole="header">{step.title}</Text>
              <ScrollView
                style={{ maxHeight: 96 }}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              >
                <Text style={s.body}>{step.body}</Text>
              </ScrollView>

              {(step.primaryLabel || step.secondaryLabel) && (
                <View style={s.buttonRow}>
                  {!!step.secondaryLabel && (
                    <TouchableOpacity onPress={step.onSecondary || exit} style={s.secondaryBtn}>
                      <Text style={s.secondaryText}>{step.secondaryLabel}</Text>
                    </TouchableOpacity>
                  )}
                  {!!step.primaryLabel && (
                    <TouchableOpacity onPress={handlePrimary} activeOpacity={0.9}>
                      <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.primaryBtn}>
                        <Text style={s.primaryText}>{step.primaryLabel}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const Blocker = ({ style }) => (
  <View style={[{ position: 'absolute' }, style]} pointerEvents="auto" />
);

/**
 * Below the target when there is room, otherwise above; centred when there is
 * no target. Never over the target, always inside the safe area.
 */
function pickPlacement({ cutout, tooltipH, SH, insets, centred }) {
  if (centred || !cutout) {
    return { style: { top: SH / 2 - Math.max(tooltipH, 120) / 2, left: 0, right: 0 } };
  }
  const h = tooltipH || 150;
  const below = cutout.y + cutout.height + TOOLTIP_GAP;
  const fitsBelow = below + h <= SH - insets.bottom - 16;
  if (fitsBelow) return { style: { top: below, left: 0, right: 0 } };

  const above = cutout.y - TOOLTIP_GAP - h;
  const top = Math.max(insets.top + 56, above);
  return { style: { top, left: 0, right: 0 } };
}

const s = StyleSheet.create({
  bannerSlot: { position: 'absolute', top: 0, left: 0, right: 0 },
  exit: {
    position: 'absolute', right: 12,
    minWidth: 44, height: 44,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10,
  },
  exitText: { fontFamily: MF.medium, fontSize: 13, color: MC.textTertiary },

  tooltipWrap: { position: 'absolute', alignItems: 'center', paddingHorizontal: 16 },
  tooltip: {
    width: '100%', maxWidth: TOOLTIP_MAX_W, padding: 16,
    backgroundColor: MC.surfaceRaised, borderRadius: MR.card,
    borderWidth: 1, borderColor: MC.cardBorder,
  },

  progress: {
    fontFamily: MF.medium, fontSize: 12, color: MC.textTertiary, marginBottom: 6,
    fontVariant: ['tabular-nums'],
  },
  title: { fontFamily: MF.semibold, fontSize: 16, color: MC.text, marginBottom: 6 },
  body: { fontFamily: MF.regular, fontSize: 14, lineHeight: 20, color: MC.textSecondary },

  buttonRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 8, marginTop: 14,
  },
  primaryBtn: {
    minWidth: 96, height: 40, borderRadius: MR.button,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
  },
  primaryText: { fontFamily: MF.semibold, fontSize: 13, color: MC.text, letterSpacing: 0.3 },
  secondaryBtn: { height: 40, justifyContent: 'center', paddingHorizontal: 12 },
  secondaryText: { fontFamily: MF.medium, fontSize: 13, color: MC.textSecondary },
});
