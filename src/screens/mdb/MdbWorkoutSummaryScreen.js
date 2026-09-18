/**
 * Screens 05 + 06 — Workout Summary ("verified performance receipt").
 * Port of `screen_05_workout_summary.html` and its sparse variant
 * `screen_06_workout_summary_sparse.html`.
 *
 * 05 and 06 are the same screen in two states, not two screens. The pack's rule
 * (PRD B.1) is zero scaffolding: with no PRs and no wearable, those sections are
 * *absent* — no placeholder cards, no "connect your watch" teasers — and the 2×2
 * stat grid grows from 30px to 36px figures with roomier padding to carry the
 * page on its own. That switch is derived here, never passed in.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { MC, MG, MF, MR } from '../../theme/mdbKit';
import MdbWellnessCard from '../../components/mdb/MdbWellnessCard';
import { BrandFooter } from '../../components/mdb/MdbPrimitives';
import { fetchWorkoutDetail, fetchWellnessToday } from '../../services/workoutService';
import { isoDate } from '../../utils/mdbWorkout';

export default function MdbWorkoutSummaryScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { workoutLogId, summary, live = false } = route.params || {};

  const [detail, setDetail] = useState(summary || null);
  const [wellnessDate, setWellnessDate] = useState(null);
  const [loading, setLoading] = useState(!summary);

  useEffect(() => {
    (async () => {
      try {
        if (!summary) setDetail(await fetchWorkoutDetail(workoutLogId));
        // A.5 — the survey appears only on the day's first completed workout,
        // and only when this screen is the genuine just-finished landing (not
        // browsed from History/Calendar) — otherwise a past session's summary
        // could save today's wellness mislabeled against the wrong session.
        if (live) {
          try {
            const date = isoDate(new Date());
            const already = await fetchWellnessToday(date);
            if (!already) setWellnessDate(date);
          } catch { /* survey is optional */ }
        }
      } catch { /* fall through to whatever we have */ }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) {
    return (
      <View style={[s.screen, s.center]}>
        <ActivityIndicator color={MC.violetLight} />
      </View>
    );
  }

  const sets = detail?.sets || [];
  const exercises = detail?.snapshot?.exercises || [];
  const prSets = sets.filter((st) => st.isPr);
  const prs = collapsePrs(prSets, exercises);

  const targetSets = exercises.reduce((n, ex) => n + (Number(ex.sets) || 0), 0);
  const doneSets = sets.length;
  const exerciseCount = exercises.length
    || new Set(sets.map((st) => st.exerciseId)).size;
  const calories = detail?.finalCalorieValue != null ? Math.round(Number(detail.finalCalorieValue)) : null;

  // Wearable telemetry does not exist yet (Part C) — so the HR block never
  // renders, and its absence is exactly what puts the screen in sparse mode.
  const hasWearable = false;
  const sparse = prs.length === 0 && !hasWearable;

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 20 }]}
      >
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View style={s.hero}>
          <Text style={s.heroEyebrow}>SESSION COMPLETE</Text>
          <Text style={s.heroTitle}>{detail?.snapshot?.name || 'Workout'}</Text>
          <Text style={s.heroDate}>{longDate(detail?.workoutDate)}</Text>
        </View>

        {/* ── 2×2 stat grid ────────────────────────────────────────────── */}
        <View style={[s.statCard, sparse && s.statCardSparse]}>
          <View style={s.statGrid}>
            <StatCell
              value={detail?.durationMinutes ?? 0}
              unit="min"
              label="DURATION"
              sparse={sparse}
              divider
            />
            <StatCell
              value={Math.round(Number(detail?.totalVolume) || 0).toLocaleString()}
              unit="kg"
              label="TOTAL VOLUME"
              sparse={sparse}
            />
            <StatCell
              value={doneSets}
              unit={targetSets ? `/ ${targetSets}` : null}
              unitMuted
              label="SETS COMPLETED"
              sparse={sparse}
              divider
              topBorder
            />
            <StatCell
              value={exerciseCount}
              label="EXERCISES"
              sparse={sparse}
              topBorder
            />
          </View>

          {/* Estimated calories — omitted entirely when we have no figure. */}
          {calories != null && !sparse && (
            <View style={s.calRow}>
              <Text style={s.calValue}>{calories.toLocaleString()} kcal</Text>
              <Text style={s.calLabel}>ESTIMATED CALORIES</Text>
            </View>
          )}
        </View>

        {/* ── Personal records — 3px amber left border, typography only ─── */}
        {prs.length > 0 && (
          <View style={s.prCard}>
            <View style={s.prEdge} />
            <View style={s.prHead}>
              <Text style={s.prCount}>
                {prs.length} PERSONAL RECORD{prs.length === 1 ? '' : 'S'}
              </Text>
              <View style={s.prDot} />
            </View>

            {prs.map((pr, i) => (
              <View key={`${pr.exerciseId}-${i}`}>
                {i > 0 && <View style={s.prDivider} />}
                <View style={s.prRow}>
                  <Text style={s.prNewBest}>NEW BEST</Text>
                  <View style={s.prValueRow}>
                    <Text style={s.prName} numberOfLines={1}>{pr.name}</Text>
                    <Text style={s.prValue}>{pr.value}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Wellness survey ──────────────────────────────────────────── */}
        {!!wellnessDate && (
          <MdbWellnessCard
            date={wellnessDate}
            sessionId={detail?.id || workoutLogId}
            note={sparse ? 'First session log' : '1 per day'}
          />
        )}

        {/* ── Share session card ───────────────────────────────────────── */}
        <TouchableOpacity
          style={s.shareBtn}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('MdbShareCard', { date: detail?.workoutDate, seedWorkoutLogId: detail?.id || workoutLogId })}
        >
          <Text style={s.shareText}>Share session card</Text>
          <Text style={s.shareArrow}>↗</Text>
        </TouchableOpacity>

        <BrandFooter note="Verified Performance Receipt" />
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── 84pt sticky DONE bar ─────────────────────────────────────────── */}
      <View style={[s.bottomBar, { paddingBottom: 12 + insets.bottom }]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('MdbTrainingHub')}
        >
          <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.doneBtn}>
            <Text style={s.doneText}>DONE</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── One cell of the 2×2 grid ────────────────────────────────────────────── */
function StatCell({ value, unit, unitMuted, label, sparse, divider, topBorder }) {
  return (
    <View style={[
      s.statCell,
      divider && s.statCellDivider,
      topBorder && (sparse ? s.statCellTopSparse : s.statCellTop),
    ]}>
      <Text style={[s.statValue, sparse && s.statValueSparse]}>
        {value}
        {!!unit && <Text style={[s.statUnit, unitMuted && s.statUnitMuted]}> {unit}</Text>}
      </Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

/**
 * One "NEW BEST" line per exercise — a member can trip several PR types on the
 * same lift in one session, and the pack shows the lift once, not three times.
 */
function collapsePrs(prSets, exercises) {
  const nameOf = (id) => exercises.find((e) => e.exerciseId === id)?.name || 'Exercise';
  const best = new Map();
  for (const st of prSets) {
    const existing = best.get(st.exerciseId);
    const weight = Number(st.actualWeight) || 0;
    if (!existing || weight > existing.weight) {
      best.set(st.exerciseId, {
        exerciseId: st.exerciseId,
        name: nameOf(st.exerciseId),
        weight,
        value: st.actualWeight != null
          ? `${trim(st.actualWeight)} kg × ${st.actualReps ?? '—'} reps`
          : `${st.actualReps ?? '—'} reps`,
      });
    }
  }
  return [...best.values()];
}

const trim = (n) => (Number.isInteger(Number(n)) ? String(Number(n)) : String(n));

const longDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MC.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingBottom: 100, gap: 24 },

  hero: { alignItems: 'center', gap: 4, paddingTop: 8 },
  heroEyebrow: {
    fontFamily: MF.semibold, fontSize: 11, letterSpacing: 1.8,
    textTransform: 'uppercase', color: MC.textSecondary,
  },
  heroTitle: {
    fontFamily: MF.semibold, fontSize: 22, color: MC.text,
    letterSpacing: -0.3, textAlign: 'center',
  },
  heroDate: { fontFamily: MF.medium, fontSize: 12, color: MC.textTertiary },

  /* Stat grid */
  statCard: {
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder,
    borderRadius: MR.card, padding: 20,
  },
  statCardSparse: {
    padding: 24,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCell: { width: '50%', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 12 },
  statCellDivider: { borderRightWidth: 1, borderRightColor: MC.cardBorder },
  statCellTop: { borderTopWidth: 1, borderTopColor: MC.cardBorder, paddingTop: 12, marginTop: 12 },
  statCellTopSparse: { borderTopWidth: 1, borderTopColor: MC.cardBorder, paddingTop: 16, marginTop: 16 },
  statValue: {
    fontFamily: MF.monoSemi, fontSize: 30, color: MC.text,
    fontVariant: ['tabular-nums'], marginBottom: 6,
  },
  statValueSparse: { fontSize: 36, marginBottom: 8 },
  statUnit: { fontFamily: MF.regular, fontSize: 18, color: MC.textSecondary },
  statUnitMuted: { color: MC.textTertiary },
  statLabel: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
  },

  calRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6,
    paddingTop: 16, marginTop: 20,
    borderTopWidth: 1, borderTopColor: MC.cardBorder,
  },
  calValue: {
    fontFamily: MF.mono, fontSize: 16, color: MC.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  calLabel: {
    fontFamily: MF.regular, fontSize: 10, letterSpacing: 1,
    textTransform: 'uppercase', color: MC.textTertiary,
  },

  /* PR card */
  prCard: {
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder,
    borderRadius: MR.card, padding: 16, paddingLeft: 19, overflow: 'hidden',
  },
  prEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: MC.warm },
  prHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  prCount: {
    fontFamily: MF.bold, fontSize: 11, color: MC.warm,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  prDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: MC.warm,
    shadowColor: MC.warm, shadowOpacity: 0.5, shadowRadius: 3, shadowOffset: { width: 0, height: 0 },
  },
  prDivider: { height: 1, backgroundColor: MC.cardBorder, marginVertical: 8 },
  prRow: { paddingVertical: 8 },
  prNewBest: {
    fontFamily: MF.medium, fontSize: 11, color: MC.textTertiary,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2,
  },
  prValueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  prName: { fontFamily: MF.medium, fontSize: 16, color: MC.text, flexShrink: 1 },
  prValue: {
    fontFamily: MF.monoSemi, fontSize: 20, color: MC.text,
    fontVariant: ['tabular-nums'],
  },

  /* Share */
  shareBtn: {
    height: 44, borderRadius: MR.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: MC.cardBorder,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  shareText: { fontFamily: MF.medium, fontSize: 13, color: MC.textSecondary },
  shareArrow: { fontFamily: MF.medium, fontSize: 14, color: MC.textSecondary },

  /* Sticky DONE */
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: MC.bg,
  },
  doneBtn: { height: 46, borderRadius: MR.button, alignItems: 'center', justifyContent: 'center' },
  doneText: {
    fontFamily: MF.semibold, fontSize: 14, letterSpacing: 1.4,
    textTransform: 'uppercase', color: MC.white,
  },
});
