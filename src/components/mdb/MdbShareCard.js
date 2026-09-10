/**
 * Screens 12 / 13 / 14 — the shareable session card.
 * Port of `screen_12_shareable_session_card_feed.html`,
 * `screen_13_..._story.html` and `screen_14_..._pr.html`.
 *
 * 14 is not a third card: it is the PR block inside 12 and 13, so this renders
 * one card in two formats with a conditional records section.
 *   feed  → 1080 × 1350 (4:5)
 *   story → 1080 × 1920 (9:16), with safe top/bottom zones and an empty middle
 *           band left clear for stickers
 *
 * (Screen 15, the wearable variant, is deliberately not built — it only adds
 * HR/strain rows and there is no wearable data source until Part C.)
 *
 * Privacy gate, from the pack: never body weight, recovery scores, nutrition
 * adherence, or photos. Only what is on a workout receipt.
 *
 * Every dimension derives from `u`, the ratio of the rendered width to the
 * pack's 410pt reference canvas, so the layout is identical at preview size and
 * at 1080px capture size.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { MC, MG, MF } from '../../theme/mdbKit';

// The pack previews the 1080-wide canvas at 410pt; all its type sizes are quoted
// at that scale, so 410 is the reference unit.
const REF_W = 410;
export const FEED_RATIO = 1350 / 1080;
export const STORY_RATIO = 1920 / 1080;
export const OUTPUT_WIDTH = 1080;

export default function MdbShareCard({ cardRef, data, format = 'feed', width = REF_W }) {
  const u = width / REF_W;
  const ratio = format === 'story' ? STORY_RATIO : FEED_RATIO;
  const height = width * ratio;
  const story = format === 'story';

  const {
    title = 'Workout',
    date,
    durationMinutes,
    volumeKg,
    setsDone,
    setsTotal,
    exerciseCount,
    prs = [],
    memberName,
  } = data || {};

  return (
    <View
      ref={cardRef}
      collapsable={false}
      style={[s.canvas, { width, height, padding: 24 * u }]}
    >
      {/* ── Wordmark ─────────────────────────────────────────────────────── */}
      <View style={{ alignItems: 'center', paddingTop: 8 * u }}>
        <Text style={[s.wordmark, { fontSize: 13 * u, letterSpacing: 3.25 * u }]}>
          MAISON DE BUILD
        </Text>
        <Text style={[s.wordmarkSub, { fontSize: 8 * u, letterSpacing: 2.8 * u, marginTop: 2 * u }]}>
          STUDIO PERFORMANCE RECORD
        </Text>
      </View>

      {/* ── Session header ───────────────────────────────────────────────── */}
      <View style={{ alignItems: 'center', paddingTop: 8 * u }}>
        <Text
          style={[s.title, { fontSize: titleSize(title) * u, lineHeight: titleSize(title) * 1.15 * u }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text style={[s.date, { fontSize: 10 * u, marginTop: 4 * u }]}>{longDate(date)}</Text>
      </View>

      {/* The card's only gradient, per the pack. */}
      <LinearGradient
        colors={MG.primary}
        start={MG.startX}
        end={MG.endX}
        style={{ height: 1, width: '100%', marginVertical: 8 * u }}
      />

      {/* Story format leaves a clear band here for stickers/text. */}
      {story && <View style={{ flex: 1 }} />}

      {/* ── 2×2 stat grid ────────────────────────────────────────────────── */}
      <View style={[s.grid, { paddingVertical: 8 * u }]}>
        <Stat u={u} value={`${durationMinutes ?? 0} min`} label="DURATION" />
        <Stat u={u} value={volumeLabel(volumeKg)} label="TOTAL VOLUME" big={volumeKg >= 100000} />
        <Stat u={u} value={setsTotal ? `${setsDone} of ${setsTotal}` : `${setsDone}`} label="SETS" />
        <Stat u={u} value={`${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}`} label="EXERCISES" />
      </View>

      {story && <View style={{ flex: 1 }} />}

      {/* ── Records (screen 14's block — amber only on "New best") ───────── */}
      {prs.length > 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 8 * u, gap: 2 * u }}>
          {prs.length > 1 && (
            <Text style={[s.prCount, { fontSize: 10 * u }]}>
              {prs.length} Personal Records
            </Text>
          )}
          {prs.slice(0, 2).map((pr, i) => (
            <Text key={i} style={[s.prRow, { fontSize: 10 * u }]}>
              {prs.length === 1 && <Text style={s.prAccent}>New best </Text>}
              {prs.length === 1 ? '— ' : ''}{pr}
            </Text>
          ))}
        </View>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <View style={[s.footer, { paddingTop: 8 * u }]}>
        <Text style={[s.member, { fontSize: 11 * u }]} numberOfLines={1}>{memberName}</Text>
        <Text style={[s.verified, { fontSize: 8 * u, letterSpacing: 1.6 * u }]}>VERIFIED LOG</Text>
      </View>
    </View>
  );
}

function Stat({ u, value, label, big }) {
  return (
    <View style={s.statCell}>
      <Text style={[s.statValue, { fontSize: (big ? 18 : 22) * u, marginBottom: 4 * u }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[s.statLabel, { fontSize: 8 * u, letterSpacing: 0.8 * u }]}>{label}</Text>
    </View>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** Auto-shrink: 20 → 17 → 15 (the pack's 48/40/36 at 1080, scaled to 410). */
function titleSize(title) {
  const len = String(title || '').length;
  if (len > 34) return 15;
  if (len > 28) return 17;
  return 20;
}

/** 6-digit volumes step down a size so the grid never wraps. */
function volumeLabel(kg) {
  const v = Math.round(Number(kg) || 0);
  return `${v.toLocaleString()} kg`;
}

function longDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const s = StyleSheet.create({
  canvas: {
    backgroundColor: MC.bg,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  wordmark: {
    fontFamily: MF.semibold,
    color: MC.text,
    textTransform: 'uppercase',
  },
  wordmarkSub: {
    fontFamily: MF.regular,
    color: MC.textTertiary,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: MF.semibold,
    color: MC.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  date: { fontFamily: MF.mono, color: MC.textTertiary, fontVariant: ['tabular-nums'] },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCell: { width: '50%', alignItems: 'center', paddingVertical: 8 },
  statValue: {
    fontFamily: MF.monoSemi,
    color: MC.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: MF.semibold,
    color: MC.textTertiary,
    textTransform: 'uppercase',
  },

  prCount: { fontFamily: MF.semibold, color: MC.warm },
  prRow: { fontFamily: MF.medium, color: MC.text, textAlign: 'center' },
  // Amber is used on the words "New best" and nowhere else — no icons, no confetti.
  prAccent: { color: MC.warm },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  member: { fontFamily: MF.medium, color: MC.textSecondary },
  verified: {
    fontFamily: MF.mono,
    color: MC.textTertiary,
    textTransform: 'uppercase',
  },
});
