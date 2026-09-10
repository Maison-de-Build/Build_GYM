/**
 * Screen 11 — Template Detail (pre-assignment preview).
 * Port of `screen_11_template_detail.html`.
 *
 * Header card (title, violet category chip, cyan target chip, frequency chip,
 * stats, muscle line), the exercise sequence with each row's **resolved** load
 * on the right — "@ 62.5 kg" over "75% of your max", never the raw formula —
 * a recovery-readiness strip, and a sticky 180pt scheduling drawer.
 *
 * The drawer's day buttons carry three states, matching what self-assign
 * actually enforces:
 *   empty            → assignable
 *   replaces         → a self-assigned workout already sits there (confirm)
 *   trainer_blocked  → a trainer workout owns that date (409, not assignable)
 * The CTA renames itself to the chosen day ("SCHEDULE FOR THURSDAY").
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { MC, MG, MF, MR, MS, RECOVERY, recoveryStatus } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import { GradientRing } from '../../components/mdb/MdbPrimitives';
import {
  previewTemplate, selfAssignTemplate, fetchInstances, fetchMuscleRecovery,
} from '../../services/workoutService';
import {
  estimatedMinutes, intensityLabel, titleCase, isoDate, targetLine,
} from '../../utils/mdbWorkout';

const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_FULL = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const SCHEDULE_WINDOW_DAYS = 15; // today .. today+14, the self-assign range

export default function MdbTemplateDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { templateId, template: seed, date: presetDate } = route.params || {};

  const [detail, setDetail] = useState(seed || null);
  const [recovery, setRecovery] = useState([]);
  const [instances, setInstances] = useState({ today: [], upcoming: [] });
  const [selected, setSelected] = useState(presetDate || null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [prev, rec, inst] = await Promise.allSettled([
        previewTemplate(templateId),
        fetchMuscleRecovery(),
        fetchInstances(),
      ]);
      // Preview is the source of resolved loads; fall back to the browse row so
      // the screen still renders (unresolved) if the endpoint is unavailable.
      if (prev.status === 'fulfilled' && prev.value) setDetail(prev.value);
      setRecovery(rec.status === 'fulfilled' ? (rec.value || []) : []);
      setInstances(inst.status === 'fulfilled' ? (inst.value || { today: [], upcoming: [] }) : { today: [], upcoming: [] });
      setLoading(false);
    })();
  }, [templateId]);

  const exercises = useMemo(
    () => [...(detail?.exercises || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [detail],
  );

  /* ── Scheduling window with per-day state ─────────────────────────────── */
  const days = useMemo(() => {
    const taken = new Map();
    [...(instances.today || []), ...(instances.upcoming || [])].forEach((row) => {
      if (row.status === 'cancelled') return;
      const key = String(row.workoutDate).slice(0, 10);
      const role = row.assignedByRole === 'trainer' ? 'trainer_blocked' : 'replaces';
      // A trainer row always wins — it is the one the backend refuses to displace.
      if (taken.get(key) !== 'trainer_blocked') taken.set(key, role);
    });

    const now = new Date();
    return Array.from({ length: SCHEDULE_WINDOW_DAYS }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const iso = isoDate(d);
      return {
        iso,
        abbr: DAY_ABBR[d.getDay()],
        full: DAY_FULL[d.getDay()],
        num: String(d.getDate()).padStart(2, '0'),
        state: taken.get(iso) || 'empty',
      };
    });
  }, [instances]);

  const selectedDay = days.find((d) => d.iso === selected) || null;

  /* ── Recovery readiness for the muscles this template trains ──────────── */
  const readiness = useMemo(() => {
    const hit = new Set(exercises.map((e) => e.muscleGroupPrimary).filter(Boolean));
    return recovery.filter((m) => hit.has(m.muscleGroup)).slice(0, 3);
  }, [recovery, exercises]);

  /* ── Schedule ─────────────────────────────────────────────────────────── */
  const schedule = useCallback(async (replace = false) => {
    if (!selectedDay || saving) return;
    setSaving(true);
    try {
      await selfAssignTemplate(templateId, selectedDay.iso, replace);
      navigation.navigate('MdbTrainingHub');
    } catch (e) {
      const status = e?.response?.status;
      const code = e?.response?.data?.code;
      if (status === 409 && code === 'SELF_ASSIGN_EXISTS') {
        Alert.alert(
          'Replace that day\'s workout?',
          'You already have a workout scheduled for this date.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Replace', style: 'destructive', onPress: () => schedule(true) },
          ],
        );
      } else {
        Alert.alert('Could not schedule', e?.response?.data?.message || 'Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }, [selectedDay, saving, templateId, navigation]);

  if (loading && !detail) {
    return (
      <View style={[s.screen, s.center]}>
        <ActivityIndicator color={MC.violetLight} />
      </View>
    );
  }

  const mins = estimatedMinutes(exercises);
  const intensity = intensityLabel(exercises);
  const muscles = (detail?.muscleGroups || []).map(titleCase).join(' · ');
  const frequency = (detail?.frequencyFit || [])[0];

  const notice = !selectedDay
    ? 'Select a day to assign this program'
    : selectedDay.state === 'trainer_blocked'
      ? 'Your coach has already programmed this day'
      : selectedDay.state === 'replaces'
        ? 'This will replace the workout already on that day'
        : 'Free — no coin charge';

  const blocked = selectedDay?.state === 'trainer_blocked';

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      <View style={[s.topBar, { marginTop: insets.top }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MdbIcon name="chevron-left" size={20} color={MC.textSecondary} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Program Detail</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* ── Header block ───────────────────────────────────────────────── */}
        <View style={s.header}>
          <Text style={s.title}>{detail?.name}</Text>
          <View style={s.tagRow}>
            {!!detail?.category && (
              <View style={s.tagViolet}><Text style={s.tagVioletText}>{titleCase(detail.category)}</Text></View>
            )}
            {!!detail?.activityTarget && (
              <View style={s.tagCyan}><Text style={s.tagCyanText}>{titleCase(detail.activityTarget)}</Text></View>
            )}
            {!!frequency && (
              <View style={s.tagNeutral}><Text style={s.tagNeutralText}>{frequency} program</Text></View>
            )}
          </View>
          <Text style={s.headerStats}>
            {exercises.length} exercise{exercises.length === 1 ? '' : 's'}
            {mins ? ` · ${mins} min` : ''}{intensity ? ` · ${intensity}` : ''}
          </Text>
          {!!muscles && <Text style={s.headerMuscles}>{muscles}</Text>}
        </View>

        {/* ── Exercise sequence with resolved loads ──────────────────────── */}
        <View style={s.listCard}>
          <View style={s.listHead}>
            <Text style={s.listHeadLabel}>EXERCISE SEQUENCE</Text>
            <Text style={s.listHeadRight}>RESOLVED LOAD</Text>
          </View>

          {exercises.map((ex, i) => {
            const load = resolvedLoad(ex);
            return (
              <View key={`${ex.exerciseId}-${i}`} style={[s.exRow, i > 0 && s.exRowDivider]}>
                <View style={s.exLeft}>
                  <GradientRing size={28}>
                    <Text style={s.exLetter}>{String.fromCharCode(65 + i)}</Text>
                  </GradientRing>
                  <View style={s.exBody}>
                    <Text style={s.exName} numberOfLines={1}>{ex.name}</Text>
                    <Text style={s.exReps}>{repsLine(ex)}</Text>
                  </View>
                </View>

                <View style={s.exRight}>
                  <Text style={[s.exLoad, !load.value && s.exLoadTbd]}>{load.value || 'Weight TBD'}</Text>
                  <Text style={s.exLoadNote}>{load.note}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Recovery readiness ─────────────────────────────────────────── */}
        {readiness.length > 0 && (
          <View style={s.readinessCard}>
            <Text style={s.readinessLabel}>RECOVERY READINESS</Text>
            <View style={s.readinessRow}>
              {readiness.map((m, i) => {
                const meta = RECOVERY[m.status || recoveryStatus(m.score)] || RECOVERY.fresh;
                return (
                  <React.Fragment key={m.muscleGroup}>
                    {i > 0 && <Text style={s.readinessPipe}>|</Text>}
                    <View style={s.readinessItem}>
                      <Text style={s.readinessMuscle}>{titleCase(m.muscleGroup)} — </Text>
                      <Text style={[s.readinessState, { color: meta.color }]}>{meta.label}</Text>
                      <View style={[s.readinessDot, { backgroundColor: meta.color }]} />
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ height: 200 }} />
      </ScrollView>

      {/* ── Sticky scheduling drawer ─────────────────────────────────────── */}
      <View style={[s.drawer, { paddingBottom: 16 + insets.bottom }]}>
        <View style={s.drawerHead}>
          <Text style={s.drawerLabel}>ASSIGN TO DATE (TODAY TO TODAY+14)</Text>
          <Text style={s.drawerFree}>Free</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.dayRow}
        >
          {days.map((d) => {
            const on = d.iso === selected;
            const isBlocked = d.state === 'trainer_blocked';
            return (
              <TouchableOpacity
                key={d.iso}
                style={[s.dayBtn, on && s.dayBtnOn, isBlocked && s.dayBtnBlocked]}
                onPress={() => setSelected(d.iso)}
                activeOpacity={0.8}
              >
                <Text style={[s.dayAbbr, on && s.dayAbbrOn]}>{d.abbr}</Text>
                <Text style={[s.dayNum, on && s.dayNumOn]}>{d.num}</Text>
                {d.state !== 'empty' && (
                  <View style={[s.dayFlag, isBlocked ? s.dayFlagBlocked : s.dayFlagReplace]} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={s.notice}>{notice}</Text>

        {blocked || !selectedDay ? (
          <View style={[s.cta, s.ctaDisabled]}>
            <Text style={s.ctaTextDisabled}>
              {blocked ? 'DATE UNAVAILABLE' : 'SELECT A DAY'}
            </Text>
          </View>
        ) : (
          <TouchableOpacity onPress={() => schedule(false)} activeOpacity={0.9} disabled={saving}>
            <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.cta}>
              <Text style={s.ctaText}>
                {saving ? 'SCHEDULING…' : `SCHEDULE FOR ${selectedDay.full}`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** "4 × 8–10" — sets × reps, without the load (which sits on the right). */
function repsLine(ex) {
  const sets = ex.sets ?? ex.targetSets;
  if (ex.measurementType && ex.measurementType !== 'weight_reps') return targetLine(ex);
  if (!sets) return `${ex.targetReps ?? '—'}`;
  return `${sets} × ${ex.targetReps ?? '—'}`;
}

/**
 * The right-hand load column. The pack's rule: show the resolved number and a
 * plain-language source underneath — never the percentage math itself.
 */
function resolvedLoad(ex) {
  if (ex.equipmentType === 'bodyweight' && ex.targetWeight == null) {
    return { value: 'Bodyweight', note: 'no added load' };
  }
  if (ex.targetWeight == null || ex.weightSource === 'uncalibrated') {
    return { value: null, note: 'log in session' };
  }
  const value = `@ ${trim(ex.targetWeight)} kg`;
  switch (ex.weightSource) {
    case 'percentage_resolved':
      return { value, note: ex.originalPercentage ? `${trim(ex.originalPercentage)}% of your max` : 'of your max' };
    case 'carry_forward':
      return { value, note: 'from last session' };
    case 'absolute_prescribed':
    default:
      return { value, note: 'prescribed' };
  }
}

const trim = (n) => (Number.isInteger(Number(n)) ? String(Number(n)) : String(n));

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MC.bg },
  center: { alignItems: 'center', justifyContent: 'center' },

  topBar: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: MS.hMargin,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: MF.semibold, fontSize: 16, color: MC.text, letterSpacing: -0.2 },

  scroll: { paddingHorizontal: MS.hMargin, paddingTop: 16, gap: 16 },

  header: { gap: 6 },
  title: { fontFamily: MF.semibold, fontSize: 20, color: MC.text, letterSpacing: -0.3 },
  tagRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  tagViolet: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: MR.xs,
    borderWidth: 1, borderColor: 'rgba(120,61,236,0.6)', backgroundColor: 'rgba(120,61,236,0.1)',
  },
  tagVioletText: { fontFamily: MF.semibold, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', color: MC.violetLight },
  tagCyan: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: MR.xs,
    borderWidth: 1, borderColor: 'rgba(6,180,213,0.6)', backgroundColor: 'rgba(6,180,213,0.1)',
  },
  tagCyanText: { fontFamily: MF.semibold, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', color: MC.cyan },
  tagNeutral: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: MR.xs,
    borderWidth: 1, borderColor: MC.cardBorder, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tagNeutralText: { fontFamily: MF.medium, fontSize: 9, color: MC.textTertiary },
  headerStats: { fontFamily: MF.medium, fontSize: 13, color: MC.textSecondary, paddingTop: 2 },
  headerMuscles: { fontFamily: MF.regular, fontSize: 11, color: MC.textTertiary },

  listCard: {
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder,
    borderRadius: MR.card, overflow: 'hidden',
  },
  listHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: MC.cardBorder,
  },
  listHeadLabel: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  listHeadRight: { fontFamily: MF.mono, fontSize: 10, color: MC.cyan },

  exRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14 },
  exRowDivider: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  exLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  exLetter: { fontFamily: MF.bold, fontSize: 11, color: MC.text },
  exBody: { flex: 1, minWidth: 0 },
  exName: { fontFamily: MF.semibold, fontSize: 14, color: MC.text },
  exReps: { fontFamily: MF.regular, fontSize: 12, color: MC.textSecondary, marginTop: 1 },
  exRight: { alignItems: 'flex-end' },
  exLoad: {
    fontFamily: MF.monoSemi, fontSize: 13, color: MC.text,
    fontVariant: ['tabular-nums'],
  },
  exLoadTbd: { fontFamily: MF.medium, fontSize: 11, color: MC.textTertiary },
  exLoadNote: { fontFamily: MF.regular, fontSize: 9, color: MC.textTertiary, marginTop: 1 },

  readinessCard: {
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder,
    borderRadius: MR.card, padding: 12,
  },
  readinessLabel: {
    fontFamily: MF.semibold, fontSize: 9, letterSpacing: 1,
    textTransform: 'uppercase', color: MC.textTertiary, marginBottom: 6,
  },
  readinessRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readinessItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  readinessMuscle: { fontFamily: MF.regular, fontSize: 11, color: MC.text },
  readinessState: { fontFamily: MF.semibold, fontSize: 11 },
  readinessDot: { width: 6, height: 6, borderRadius: 3 },
  readinessPipe: { color: 'rgba(255,255,255,0.2)', fontSize: 11 },

  /* Scheduling drawer */
  drawer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: MC.bg,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: MS.hMargin, paddingTop: 12, gap: 12,
  },
  drawerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  drawerLabel: {
    fontFamily: MF.regular, fontSize: 10, letterSpacing: 1,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  drawerFree: { fontFamily: MF.medium, fontSize: 10, color: MC.cyan },

  dayRow: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  dayBtn: {
    width: 44, height: 52, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: MC.cardBorder,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  dayBtnOn: { borderColor: MC.violet, backgroundColor: 'rgba(120,61,236,0.20)' },
  dayBtnBlocked: { opacity: 0.45 },
  dayAbbr: {
    fontFamily: MF.medium, fontSize: 9, letterSpacing: 0.5,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  dayAbbrOn: { fontFamily: MF.semibold, color: MC.cyan },
  dayNum: {
    fontFamily: MF.monoSemi, fontSize: 13, color: MC.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  dayNumOn: { color: MC.text },
  dayFlag: { position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2 },
  dayFlagReplace: { backgroundColor: MC.warm },
  dayFlagBlocked: { backgroundColor: MC.workedSolid },

  notice: { textAlign: 'center', fontFamily: MF.medium, fontSize: 11, color: MC.textTertiary },

  cta: { height: 44, borderRadius: MR.button, alignItems: 'center', justifyContent: 'center' },
  ctaDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: MC.cardBorder,
  },
  ctaText: {
    fontFamily: MF.semibold, fontSize: 13, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.white,
  },
  ctaTextDisabled: {
    fontFamily: MF.semibold, fontSize: 13, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
});
