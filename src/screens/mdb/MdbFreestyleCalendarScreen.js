/**
 * Screen 02 — Workout Calendar (Freestyle member).
 * Port of `screen_02_workout_calendar_freestyle.html`.
 *
 * Same fixed chrome as screen 01, three deliberate differences per the pack:
 *   · empty days show a 190px invitation card with the 56px gradient "+"
 *   · a "Suggested for you" template rail sits under it (first card = Top Pick)
 *   · the recovery strip lists all ten muscle groups, not just the session's
 * No coach attribution and no nutrition entry — those are PT-only surfaces.
 *
 * Data: GET /member/instances, GET /member/muscle-recovery,
 *       GET /workout/templates/browse (403 for PT members by design).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { MC, MG, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import GlowBlob from '../../components/mdb/GlowBlob';
import DateNavigator from '../../components/mdb/DateNavigator';
import { MuscleRecoveryStrip, MuscleDetailSheet } from '../../components/mdb/MuscleRecovery';
import { BackPill, LuxuryCard, ExerciseLetter, BrandFooter } from '../../components/mdb/MdbPrimitives';
import WorkoutDayCard from '../../components/mdb/WorkoutDayCard';
import MdbSecondaryNav from '../../components/mdb/MdbSecondaryNav';
import { fetchInstances, fetchMuscleRecovery, browseTemplates } from '../../services/workoutService';
import {
  buildDayStrip, sequenceOf, targetLoadKg, totalSets, estimatedMinutes,
  monthLabel, isoDate, relativeDateTime, titleCase,
} from '../../utils/mdbWorkout';

export default function MdbFreestyleCalendarScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [instances, setInstances] = useState({ today: [], upcoming: [], history: [] });
  const [recovery, setRecovery] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [selectedIso, setSelectedIso] = useState(() => isoDate(new Date()));
  const [openMuscle, setOpenMuscle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [inst, rec, tpl] = await Promise.allSettled([
      fetchInstances(),
      fetchMuscleRecovery(),
      browseTemplates(),
    ]);
    setInstances(inst.status === 'fulfilled' && inst.value ? inst.value : { today: [], upcoming: [], history: [] });
    setRecovery(rec.status === 'fulfilled' ? (rec.value || []) : []);
    setSuggested(tpl.status === 'fulfilled' ? (tpl.value || []).slice(0, 6) : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const days = useMemo(() => buildDayStrip(instances), [instances]);
  const selectedDay = days.find((d) => d.iso === selectedIso) || days.find((d) => d.isToday);
  const workout = selectedDay?.instances?.[0] || null;
  const sequence = useMemo(() => (workout ? sequenceOf(workout) : []), [workout]);
  const isCompleted = workout?.status === 'completed' || workout?.status === 'partial';

  const targetLoad = targetLoadKg(sequence);
  const sets = totalSets(sequence);

  const openBrowser = () => navigation.navigate('MdbTemplateBrowser', { date: selectedDay?.iso });

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      <View style={[s.header, { marginTop: insets.top }]}>
        <BackPill onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs'))} />
        <TouchableOpacity style={s.monthChip} activeOpacity={0.7}>
          <Text style={s.monthText}>{monthLabel()}</Text>
          <MdbIcon name="chevron-down" size={14} color={MC.textTertiary} />
        </TouchableOpacity>
        <View style={s.headerSpacer} />
      </View>

      <DateNavigator
        days={days}
        selectedKey={selectedDay?.key}
        onSelect={(d) => setSelectedIso(d.iso)}
      />

      {loading ? (
        <View style={s.center}><ActivityIndicator color={MC.violetLight} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MC.violetLight} />
          }
        >
          {/* ── Scheduled workout, or the inviting empty state ──────────── */}
          {workout ? (
            <WorkoutDayCard
              workout={workout}
              onBegin={() => navigation.navigate('MdbActiveSession', { instanceId: workout.id, instance: workout })}
            />
          ) : (
            <LuxuryCard style={s.emptyCard}>
              <GlowBlob size={144} color={MC.violet} opacity={0.08} style={s.emptyGlow} />
              <Text style={s.emptyText}>No workout scheduled</Text>
              <TouchableOpacity onPress={openBrowser} activeOpacity={0.85} style={s.plusShadow}>
                <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.plusBtn}>
                  <MdbIcon name="plus" size={20} color={MC.white} />
                </LinearGradient>
              </TouchableOpacity>
              <Text style={s.emptyHint}>Browse templates</Text>
            </LuxuryCard>
          )}

          {/* ── Exercise sequence (only once a workout is scheduled) ────── */}
          {sequence.length > 0 && (
            <View>
              <View style={s.sectionHead}>
                <View style={s.sectionHeadLeft}>
                  <Text style={s.sectionLabel}>EXERCISE SEQUENCE</Text>
                  <Text style={s.sectionMeta}>{String(sets).padStart(2, '0')} Sets Plan</Text>
                </View>
                {targetLoad != null && (
                  <Text style={s.sectionRight}>Target Load: {targetLoad.toLocaleString()} kg</Text>
                )}
              </View>
              <LuxuryCard style={{ overflow: 'hidden' }}>
                {sequence.map((ex, i) => {
                  const done = isCompleted || ex.completed;
                  return (
                    <TouchableOpacity
                      key={`${ex.exerciseId}-${i}`}
                      style={[s.exRow, i > 0 && s.exRowDivider]}
                      activeOpacity={0.75}
                      onPress={() => navigation.navigate('MdbExerciseDetail', { exerciseId: ex.exerciseId, name: ex.name })}
                    >
                      <ExerciseLetter letter={ex.letter} />
                      <View style={s.exBody}>
                        <Text style={s.exName} numberOfLines={1}>{ex.name}</Text>
                        <Text style={s.exTarget}>{ex.target}</Text>
                      </View>
                      <View style={done ? s.exDone : s.exPending}>
                        {done && <MdbIcon name="check" size={12} color={MC.warm} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </LuxuryCard>
            </View>
          )}

          {/* ── SUGGESTED FOR YOU ──────────────────────────────────────── */}
          {suggested.length > 0 && (
            <View>
              <View style={[s.sectionHead, { marginBottom: 12 }]}>
                <Text style={s.sectionLabel}>SUGGESTED FOR YOU</Text>
                <TouchableOpacity onPress={openBrowser} activeOpacity={0.7}>
                  <Text style={s.seeAll}>See all →</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.rail}
              >
                {suggested.map((t, i) => (
                  <TemplatePreviewCard
                    key={t.id}
                    template={t}
                    topPick={i === 0}
                    onPress={() => navigation.navigate('MdbTemplateDetail', {
                      templateId: t.id, template: t, date: selectedDay?.iso,
                    })}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── ALL 10 MUSCLE GROUPS ───────────────────────────────────── */}
          {recovery.length > 0 && (
            <View>
              <View style={s.sectionHead}>
                <View style={s.sectionHeadLeft}>
                  <Text style={s.recoveryLabel}>TARGET MUSCLE RECOVERY</Text>
                  <View style={s.countBadge}>
                    <Text style={s.countText}>{recovery.length} GROUPS</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('MdbMuscleRecovery')} activeOpacity={0.7}>
                  <Text style={s.sectionRight}>Full board →</Text>
                </TouchableOpacity>
              </View>

              <MuscleRecoveryStrip
                muscles={recovery}
                onSelect={(m) => setOpenMuscle({ ...m, lastTrainedLabel: relativeDateTime(m.lastTrainedAt) })}
              />
            </View>
          )}

          <MdbSecondaryNav navigation={navigation} showNutrition={false} />
          <BrandFooter note="Freestyle Studio Access" />
          <View style={{ height: MS.bottomRoom }} />
        </ScrollView>
      )}

      <MuscleDetailSheet muscle={openMuscle} onClose={() => setOpenMuscle(null)} />
    </View>
  );
}

/* ── One card in the "Suggested for you" rail ────────────────────────────── */
function TemplatePreviewCard({ template, topPick, onPress }) {
  const mins = template.estimatedMinutes ?? estimatedMinutes(template.exercises || []);
  const count = (template.exercises || []).length;
  return (
    <TouchableOpacity
      style={[s.tplCard, topPick && s.tplCardTop]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View>
        {topPick ? (
          <View style={s.tplTopRow}>
            <Text style={s.tplTopPick}>Top Pick</Text>
            <View style={s.tplTopDot} />
          </View>
        ) : (
          <View style={s.tplTopSpacer} />
        )}

        <Text style={s.tplTitle} numberOfLines={2}>{template.name}</Text>

        <View style={s.tplTags}>
          {!!template.activityTarget && (
            <View style={[s.tplTag, topPick && s.tplTagTop]}>
              <Text style={s.tplTagText}>{titleCase(template.activityTarget)}</Text>
            </View>
          )}
          {!!template.category && (
            <View style={[s.tplTag, topPick && s.tplTagTop]}>
              <Text style={s.tplTagText}>{titleCase(template.category)}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={s.tplFoot}>
        <Text style={s.tplFootText}>
          {count} exercise{count === 1 ? '' : 's'}{mins ? ` · ${mins} min` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MC.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    height: 52, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: MS.hMargin,
  },
  headerSpacer: { width: 40, height: 40 },
  monthChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 4, paddingHorizontal: 12, borderRadius: MR.pill,
  },
  monthText: { fontFamily: MF.medium, fontSize: 13, letterSpacing: 0.3, color: MC.textSecondary },

  // space-y-6 on this screen (24px), vs space-y-5 on screen 01.
  scroll: { paddingTop: 16, paddingHorizontal: MS.hMargin, gap: 24 },

  /* Empty state */
  emptyCard: { height: 190, padding: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  emptyGlow: { position: 'absolute' },
  emptyText: {
    fontFamily: MF.medium, fontSize: 14, color: MC.textSecondary,
    marginBottom: 16, letterSpacing: -0.2,
  },
  plusShadow: {
    shadowColor: MC.violet, shadowOpacity: 0.5,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  plusBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  emptyHint: { fontFamily: MF.medium, fontSize: 11, color: MC.textTertiary, letterSpacing: 0.4, marginTop: 12 },

  /* Sections */
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10, paddingHorizontal: 2,
  },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel: {
    fontFamily: MF.semibold, fontSize: 11, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  recoveryLabel: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  sectionMeta: { fontFamily: MF.medium, fontSize: 11, color: MC.textSecondary, fontVariant: ['tabular-nums'] },
  sectionRight: { fontFamily: MF.medium, fontSize: 10, color: MC.textTertiary },
  seeAll: { fontFamily: MF.medium, fontSize: 11, color: MC.textSecondary },
  countBadge: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: MR.xs,
    backgroundColor: 'rgba(6,180,213,0.10)',
    borderWidth: 1, borderColor: 'rgba(6,180,213,0.20)',
  },
  countText: { fontFamily: MF.medium, fontSize: 9, color: MC.cyan },

  /* Template rail */
  rail: { flexDirection: 'row', gap: 12, paddingBottom: 4 },
  tplCard: {
    width: 155, padding: 14, justifyContent: 'space-between',
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder, borderRadius: MR.card,
  },
  tplCardTop: { width: 165, borderColor: 'rgba(120,61,236,0.40)' },
  tplTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  tplTopPick: {
    fontFamily: MF.bold, fontSize: 9, color: MC.cyan,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  tplTopDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: MC.cyan },
  tplTopSpacer: { height: 16, marginBottom: 4 },
  tplTitle: { fontFamily: MF.semibold, fontSize: 13, color: MC.text, lineHeight: 18, marginBottom: 8 },
  tplTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tplTag: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: MR.sm,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  tplTagTop: { backgroundColor: 'rgba(120,61,236,0.10)', borderColor: 'rgba(120,61,236,0.30)' },
  tplTagText: { fontFamily: MF.medium, fontSize: 10, color: MC.textSecondary },
  tplFoot: { paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  tplFootText: {
    fontFamily: MF.medium, fontSize: 10, color: MC.textTertiary,
    fontVariant: ['tabular-nums'],
  },

  /* Exercise rows */
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  exRowDivider: { borderTopWidth: 1, borderTopColor: MC.cardBorder },
  exBody: { flex: 1, minWidth: 0 },
  exName: { fontFamily: MF.medium, fontSize: 14, color: MC.text },
  exTarget: { fontFamily: MF.mono, fontSize: 12, color: MC.textSecondary, fontVariant: ['tabular-nums'], marginTop: 2 },
  exDone: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderWidth: 1, borderColor: 'rgba(245,166,35,0.40)',
    alignItems: 'center', justifyContent: 'center',
  },
  exPending: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(142,130,141,0.5)' },
});
