/**
 * Screen 19 — Weekly Recap card (dashboard component, PRD B.6.8).
 * Port of `screen_19_weekly_recap_component.html`.
 *
 * A 3-second scorecard: four compact stat blocks fenced by hairlines, the
 * week-over-week line, and a mini wellness row of five dots (filled with the
 * gradient when that factor averaged 3+). Dismissible, and the dismissal is
 * remembered per week — it appears Sunday evening and Monday only.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { MC, MG, MF, MR } from '../../theme/mdbKit';
import MdbIcon from './MdbIcon';

// The five factors in the pack's dot order.
const WELLNESS_KEYS = ['sleep', 'soreness', 'energy', 'stress', 'mood'];

export default function MdbWeeklyRecapCard({ recap, wellness, onDismiss, style }) {
  if (!recap) return null;

  const deltaSessions = recap.sessionsDeltaVsLastWeek;
  const deltaVolume = recap.volumeDeltaPct;
  const positive = (deltaVolume ?? deltaSessions ?? 0) >= 0;

  return (
    <View style={[s.card, style]}>
      <View style={s.head}>
        <View>
          <Text style={s.title}>Week in Review</Text>
          <Text style={s.range}>{rangeLabel(recap.weekStart, recap.weekEnd)}</Text>
        </View>
        {!!onDismiss && (
          <TouchableOpacity onPress={onDismiss} activeOpacity={0.7} hitSlop={10}>
            <MdbIcon name="x" size={14} color={MC.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.statRow}>
        <Stat value={recap.sessions ?? 0} label="SESSIONS" />
        <Stat value={compact(recap.tonnage)} label="VOLUME" />
        <Stat value={recap.prs ?? 0} label="PRs HIT" />
        <Stat
          value={recap.planConsistencyPct != null ? `${recap.planConsistencyPct}%` : '—'}
          label="OF PLAN"
        />
      </View>

      <View style={s.compareRow}>
        <Text style={s.compareText}>{compareLabel(recap)}</Text>
        <Text style={[s.compareTag, { color: positive ? MC.fresh : MC.textTertiary }]}>
          {positive ? '▲ Progressive Overload' : '▼ Lighter week'}
        </Text>
      </View>

      <View style={s.wellnessRow}>
        <Text style={s.wellnessLabel}>Wellness Avg</Text>
        <View style={s.dots}>
          {WELLNESS_KEYS.map((k) => {
            const v = wellness?.[k];
            // A factor with no data reads as an unfilled dot, same as a low score —
            // the pack has no third state here, and inventing one would over-report.
            const filled = v != null && v >= 3;
            return filled
              ? <LinearGradient key={k} colors={MG.primary} start={MG.start} end={MG.end} style={s.dot} />
              : <View key={k} style={[s.dot, s.dotEmpty]} />;
          })}
        </View>
      </View>
    </View>
  );
}

function Stat({ value, label }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** 18,400 → "18.4k" — the pack keeps the volume block to four glyphs. */
function compact(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`;
  return String(Math.round(v));
}

function compareLabel(recap) {
  if (recap.volumeDeltaPct != null) {
    const v = Math.round(recap.volumeDeltaPct);
    return `${v >= 0 ? '+' : ''}${v}% volume vs. last week`;
  }
  const d = recap.sessionsDeltaVsLastWeek;
  if (d == null) return 'First week logged';
  return `${d >= 0 ? '+' : ''}${d} session${Math.abs(d) === 1 ? '' : 's'} vs. last week`;
}

function rangeLabel(from, to) {
  if (!from || !to) return '';
  const a = new Date(from);
  const b = new Date(to);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return '';
  const fmt = (d, withYear) => d.toLocaleDateString('en-GB', withYear
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'short' });
  return `${fmt(a, false)} — ${fmt(b, true)}`;
}

const s = StyleSheet.create({
  card: {
    backgroundColor: MC.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: MR.card,
    padding: 20,
    gap: 16,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontFamily: MF.semibold, fontSize: 14, color: MC.text },
  range: {
    fontFamily: MF.mono, fontSize: 11, color: MC.textTertiary,
    fontVariant: ['tabular-nums'], marginTop: 2,
  },

  statRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: {
    fontFamily: MF.monoSemi, fontSize: 20, color: MC.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: MF.semibold, fontSize: 8, letterSpacing: 1,
    textTransform: 'uppercase', color: MC.textTertiary, marginTop: 2,
  },

  compareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  compareText: { fontFamily: MF.medium, fontSize: 12, color: MC.textSecondary, flexShrink: 1 },
  compareTag: { fontFamily: MF.mono, fontSize: 10, fontVariant: ['tabular-nums'] },

  wellnessRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
  },
  wellnessLabel: {
    fontFamily: MF.regular, fontSize: 9, letterSpacing: 1,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotEmpty: { backgroundColor: 'rgba(255,255,255,0.20)' },
});
