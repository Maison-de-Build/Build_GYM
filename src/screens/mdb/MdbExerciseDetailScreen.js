/**
 * Screen 16 — Exercise Detail (single-lift dossier).
 * Port of `screen_16_exercise_detail.html`.
 *
 * Working Max is the anchor (PRD A.1) and gets the 36px hero with a 2px violet
 * left edge; then the verified personal record, the 12-week estimated-1RM curve,
 * the last five sessions in "3 × 10 @ 22, 24, 24 kg" shorthand, and the target
 * muscles.
 *
 * The staleness line is advisory only — the pack is explicit that it states the
 * fact ("Not updated in 68 days") and never nags.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MC, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import MdbLineChart from '../../components/mdb/MdbLineChart';
import { EmptyState } from '../../components/mdb/MdbPrimitives';
import {
  fetchWorkingMax, fetchExercisePRs, fetch1rmTrend,
  fetchExerciseSessions, fetchExerciseById,
} from '../../services/workoutService';
import { titleCase, pickHeadlinePr, prHeadlineLabel } from '../../utils/mdbWorkout';

export default function MdbExerciseDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { exerciseId, name: seedName } = route.params || {};

  const [exercise, setExercise] = useState(null);
  const [workingMax, setWorkingMax] = useState(null);
  const [prs, setPrs] = useState([]);
  const [prEst1rm, setPrEst1rm] = useState(null);
  const [trend, setTrend] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [ex, wm, pr, tr, ses] = await Promise.allSettled([
        fetchExerciseById(exerciseId),
        fetchWorkingMax(exerciseId),
        fetchExercisePRs(exerciseId),
        fetch1rmTrend(exerciseId),
        fetchExerciseSessions(exerciseId, 5),
      ]);
      setExercise(ex.status === 'fulfilled' ? ex.value : null);
      // /member/working-max returns a list when unfiltered, a row when filtered.
      const wmValue = wm.status === 'fulfilled' ? wm.value : null;
      setWorkingMax(Array.isArray(wmValue) ? wmValue[0] || null : wmValue);
      // /member/stats/prs/:id returns { prs: [...], estimated1RM } — an object,
      // NOT an array. Passing the whole thing to pickBestPr() made it call
      // {}.filter and crash the screen ("undefined is not a function").
      const prPayload = pr.status === 'fulfilled' ? pr.value : null;
      setPrs(Array.isArray(prPayload?.prs) ? prPayload.prs : (Array.isArray(prPayload) ? prPayload : []));
      setPrEst1rm(prPayload?.estimated1RM != null ? Number(prPayload.estimated1RM) : null);
      setTrend(tr.status === 'fulfilled' && Array.isArray(tr.value) ? tr.value : []);
      setSessions(ses.status === 'fulfilled' && Array.isArray(ses.value) ? ses.value : []);
      setLoading(false);
    })();
  }, [exerciseId]);

  const title = exercise?.name || seedName || 'Exercise';
  const est1rm = workingMax?.estimated1rmKg != null ? Number(workingMax.estimated1rmKg)
    : (prEst1rm != null ? prEst1rm : null);
  const bestPr = pickHeadlinePr(prs);
  const latestTrend = trend.length ? trend[trend.length - 1].est1rm : null;

  if (loading) {
    return (
      <View style={[s.screen, s.center]}>
        <ActivityIndicator color={MC.violetLight} />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      <View style={[s.topBar, { marginTop: insets.top }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MdbIcon name="chevron-left" size={20} color={MC.textSecondary} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>{title}</Text>
        {exercise?.equipmentType ? (
          <View style={s.equipChip}>
            <Text style={s.equipText}>{titleCase(exercise.equipmentType)}</Text>
          </View>
        ) : (
          <View style={s.backBtn} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* ── Working Max hero ───────────────────────────────────────────── */}
        <View style={s.wmCard}>
          <View style={s.wmEdge} />
          <View style={s.wmHead}>
            <Text style={s.wmLabel}>YOUR WORKING MAX</Text>
            <View style={s.wmBadge}><Text style={s.wmBadgeText}>Rolling Anchor</Text></View>
          </View>

          {est1rm != null ? (
            <>
              <View style={s.wmValueRow}>
                <Text style={s.wmValue}>{trim(est1rm)}</Text>
                <Text style={s.wmUnit}>kg</Text>
              </View>
              <Text style={s.wmMeta}>
                {[
                  workingMax?.updatedAt ? `Updated ${shortDate(workingMax.updatedAt)}` : null,
                  workingMax?.sourceReps && workingMax?.sourceWeightKg
                    ? `from ${workingMax.sourceReps} × ${trim(workingMax.sourceWeightKg)} kg`
                    : null,
                ].filter(Boolean).join(' · ')}
              </Text>
              {staleDays(workingMax?.updatedAt) > 30 && (
                <View style={s.wmStale}>
                  <View style={s.wmStaleDot} />
                  <Text style={s.wmStaleText}>
                    Not updated in {staleDays(workingMax.updatedAt)} days (Advisory only)
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              <View style={s.wmValueRow}>
                <Text style={s.wmValueEmpty}>Not calibrated</Text>
              </View>
              <Text style={s.wmMeta}>Log a heavy set and your working max appears here.</Text>
            </>
          )}
        </View>

        {/* ── Personal record ────────────────────────────────────────────── */}
        {!!bestPr && (
          <View style={s.prCard}>
            <View>
              <Text style={s.sectionLabel}>PERSONAL RECORD</Text>
              <Text style={s.prValue}>{prHeadlineLabel(bestPr)}</Text>
            </View>
            <View style={s.prRight}>
              <Text style={s.prDate}>{shortDate(bestPr.achievedAt)}</Text>
              <Text style={s.prVerified}>Verified Best</Text>
            </View>
          </View>
        )}

        {/* ── Estimated 1RM trend ────────────────────────────────────────── */}
        <View style={s.chartCard}>
          <View style={s.chartHead}>
            <View>
              <Text style={s.chartTitle}>Estimated 1RM</Text>
              <Text style={s.chartSub}>Last {Math.min(12, Math.max(1, trend.length))} sessions</Text>
            </View>
            {latestTrend != null && <Text style={s.chartValue}>{trim(latestTrend)} kg</Text>}
          </View>
          <MdbLineChart
            points={trend.map((t) => ({ y: t.est1rm }))}
            height={120}
            gradientId="mdb1rm"
            emptyLabel="Log two sessions to see your trend"
          />
        </View>

        {/* ── Recent sessions ────────────────────────────────────────────── */}
        <View style={s.listCard}>
          <View style={s.listHead}>
            <Text style={s.listTitle}>Recent Sessions</Text>
          </View>
          {sessions.length === 0 ? (
            <EmptyState title="No sessions logged yet" style={{ paddingVertical: 24 }} />
          ) : (
            sessions.map((row, i) => (
              <View key={row.date} style={[s.sessionRow, i > 0 && s.sessionDivider]}>
                <Text style={s.sessionDate}>{shortDate(row.date, true)}</Text>
                <Text style={s.sessionValue}>{sessionLine(row)}</Text>
              </View>
            ))
          )}
        </View>

        {/* ── Targets ────────────────────────────────────────────────────── */}
        {!!exercise?.muscleGroupPrimary && (
          <View style={s.targetCard}>
            <Text style={s.sectionLabel}>TARGETS</Text>
            <View style={s.targetRow}>
              <View style={s.targetPrimary}>
                <Text style={s.targetPrimaryText}>Primary: {titleCase(exercise.muscleGroupPrimary)}</Text>
              </View>
              {!!exercise.muscleGroupSecondary && (
                <View style={s.targetSecondary}>
                  <Text style={s.targetSecondaryText}>{titleCase(exercise.muscleGroupSecondary)}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={{ height: MS.bottomRoom }} />
      </ScrollView>
    </View>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** "3 × 10 @ 22, 24, 24 kg" — set count, top reps, then each distinct load. */
function sessionLine(row) {
  const weights = Array.isArray(row.weights) ? row.weights.filter((w) => w != null) : [];
  const loads = weights.length ? `${weights.map(trim).join(', ')} kg` : 'Bodyweight';
  const count = row.setCount ?? 0;
  const reps = row.topReps != null ? `${count} × ${row.topReps}` : `${count} sets`;
  return `${reps} @ ${loads}`;
}

const trim = (n) => {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
};

function shortDate(value, noYear) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', noYear
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

function staleDays(value) {
  if (!value) return 0;
  const d = new Date(value).getTime();
  if (isNaN(d)) return 0;
  return Math.floor((Date.now() - d) / 86400000);
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MC.bg },
  center: { alignItems: 'center', justifyContent: 'center' },

  topBar: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: MS.hMargin,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topTitle: {
    flex: 1, textAlign: 'center', maxWidth: 200,
    fontFamily: MF.medium, fontSize: 14, color: MC.text,
  },
  equipChip: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: MR.xs,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  equipText: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 0.8,
    textTransform: 'uppercase', color: MC.textTertiary,
  },

  scroll: { paddingHorizontal: MS.hMargin, paddingTop: 16, gap: 16 },

  sectionLabel: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
  },

  /* Working max */
  wmCard: {
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder,
    borderRadius: MR.card, padding: 20, paddingLeft: 22, gap: 8, overflow: 'hidden',
  },
  wmEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, backgroundColor: MC.violet },
  wmHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wmLabel: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  wmBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: MR.xs,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  wmBadgeText: { fontFamily: MF.regular, fontSize: 9, color: MC.textTertiary },
  wmValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  wmValue: {
    fontFamily: MF.monoSemi, fontSize: 36, color: MC.text,
    fontVariant: ['tabular-nums'],
  },
  wmValueEmpty: { fontFamily: MF.semibold, fontSize: 20, color: MC.textSecondary },
  wmUnit: { fontFamily: MF.regular, fontSize: 16, color: MC.textSecondary },
  wmMeta: { fontFamily: MF.regular, fontSize: 11, color: MC.textTertiary },
  wmStale: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  wmStaleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  wmStaleText: { fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary },

  /* PR */
  prCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder,
    borderRadius: MR.card, padding: 16,
  },
  prValue: {
    fontFamily: MF.monoSemi, fontSize: 20, color: MC.text,
    fontVariant: ['tabular-nums'], marginTop: 2,
  },
  prRight: { alignItems: 'flex-end' },
  prDate: {
    fontFamily: MF.mono, fontSize: 11, color: MC.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  prVerified: {
    fontFamily: MF.semibold, fontSize: 9, letterSpacing: 0.6,
    textTransform: 'uppercase', color: MC.warm, marginTop: 2,
  },

  /* Chart */
  chartCard: {
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder,
    borderRadius: MR.card, padding: 16, gap: 8,
  },
  chartHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  chartTitle: { fontFamily: MF.semibold, fontSize: 14, color: MC.text },
  chartSub: { fontFamily: MF.regular, fontSize: 11, color: MC.textSecondary, marginTop: 1 },
  chartValue: {
    fontFamily: MF.monoSemi, fontSize: 11, color: MC.cyan,
    fontVariant: ['tabular-nums'],
  },

  /* Sessions */
  listCard: {
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder,
    borderRadius: MR.card, overflow: 'hidden',
  },
  listHead: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: MC.cardBorder,
  },
  listTitle: { fontFamily: MF.semibold, fontSize: 14, color: MC.text },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, gap: 12,
  },
  sessionDivider: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  sessionDate: {
    fontFamily: MF.mono, fontSize: 12, color: MC.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  sessionValue: {
    flex: 1, textAlign: 'right',
    fontFamily: MF.mono, fontSize: 12, color: MC.text,
    fontVariant: ['tabular-nums'],
  },

  /* Targets */
  targetCard: {
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder,
    borderRadius: MR.card, padding: 16, gap: 8,
  },
  targetRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  targetPrimary: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: MR.pill,
    borderWidth: 1, borderColor: 'rgba(120,61,236,0.6)', backgroundColor: 'rgba(120,61,236,0.1)',
  },
  targetPrimaryText: { fontFamily: MF.semibold, fontSize: 10, color: MC.violetLight },
  targetSecondary: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: MR.pill,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  targetSecondaryText: { fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary },
});
