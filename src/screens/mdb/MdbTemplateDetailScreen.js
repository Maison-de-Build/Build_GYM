/**
 * Screen 11 — Template Detail (preview, before adding to a day's selection).
 * Port of `screen_11_template_detail.html`.
 *
 * Header card (title, violet category chip, cyan target chip, frequency chip,
 * stats, muscle line), the exercise sequence with each row's **resolved**
 * load on the right — "@ 62.5 kg" over "75% of your max", never the raw
 * formula — and a recovery-readiness strip.
 *
 * Scheduling itself (picking a day, committing) now happens once in the
 * multi-select browser (`MdbTemplateBrowserScreen`) — this screen is just a
 * "look before you add" step. The sticky footer toggles this template in or
 * out of the browser's in-progress selection via `route.params.onToggle`, then
 * goes back; it never calls self-assign directly.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { MC, MG, MF, MR, MS, RECOVERY, recoveryStatus } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import { GradientRing } from '../../components/mdb/MdbPrimitives';
import { previewTemplate, fetchMuscleRecovery } from '../../services/workoutService';
import { estimatedMinutes, intensityLabel, titleCase, targetLine } from '../../utils/mdbWorkout';

export default function MdbTemplateDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { templateId, template: seed, isSelected = false, onToggle } = route.params || {};

  const [detail, setDetail] = useState(seed || null);
  const [recovery, setRecovery] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [prev, rec] = await Promise.allSettled([
        previewTemplate(templateId),
        fetchMuscleRecovery(),
      ]);
      // Preview is the source of resolved loads; fall back to the browse row so
      // the screen still renders (unresolved) if the endpoint is unavailable.
      if (prev.status === 'fulfilled' && prev.value) setDetail(prev.value);
      setRecovery(rec.status === 'fulfilled' ? (rec.value || []) : []);
      setLoading(false);
    })();
  }, [templateId]);

  const exercises = useMemo(
    () => [...(detail?.exercises || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [detail],
  );

  /* ── Recovery readiness for the muscles this template trains ──────────── */
  const readiness = useMemo(() => {
    const hit = new Set(exercises.map((e) => e.muscleGroupPrimary).filter(Boolean));
    return recovery.filter((m) => hit.has(m.muscleGroup)).slice(0, 3);
  }, [recovery, exercises]);

  const toggle = () => {
    onToggle?.(templateId);
    navigation.goBack();
  };

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

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Sticky add/remove footer ──────────────────────────────────────── */}
      <View style={[s.drawer, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity onPress={toggle} activeOpacity={0.9}>
          {isSelected ? (
            <View style={[s.cta, s.ctaRemove]}>
              <MdbIcon name="check" size={14} color={MC.violetLight} />
              <Text style={s.ctaRemoveText}>REMOVE FROM SELECTION</Text>
            </View>
          ) : (
            <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.cta}>
              <Text style={s.ctaText}>ADD TO SELECTION</Text>
            </LinearGradient>
          )}
        </TouchableOpacity>
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

  /* Sticky footer */
  drawer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: MC.bg,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: MS.hMargin, paddingTop: 12,
  },
  cta: { height: 46, borderRadius: MR.button, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  ctaText: {
    fontFamily: MF.semibold, fontSize: 13, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.white,
  },
  ctaRemove: {
    backgroundColor: 'rgba(120,61,236,0.12)',
    borderWidth: 1, borderColor: 'rgba(120,61,236,0.5)',
  },
  ctaRemoveText: {
    fontFamily: MF.semibold, fontSize: 13, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.violetLight,
  },
});
