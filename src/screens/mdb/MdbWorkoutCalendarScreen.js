/**
 * Screen 01 — Workout Calendar (Trainer-Assigned).
 * Port of `screen_01_workout_calendar.html` from the Maison de Build handoff.
 *
 * Fixed chrome (back pill · month header · 7-day strip) stays pinned; only the
 * card stack scrolls, with the pack's 16px margins and 80px bottom breathing
 * room. Freestyle members are routed to screen 02 instead — see MdbTrainingHub.
 *
 * Data: GET /member/instances (today · upcoming · history) and
 *       GET /member/muscle-recovery. Nothing here is mocked.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MC, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import DateNavigator from '../../components/mdb/DateNavigator';
import MdbMonthPicker from '../../components/mdb/MdbMonthPicker';
import { MuscleRecoveryStrip, MuscleDetailSheet } from '../../components/mdb/MuscleRecovery';
import {
  BackPill, LuxuryCard, ExerciseLetter, BrandFooter,
} from '../../components/mdb/MdbPrimitives';
import WorkoutDayCard from '../../components/mdb/WorkoutDayCard';
import WorkoutEmptyState from '../../components/mdb/WorkoutEmptyState';
import MdbSecondaryNav from '../../components/mdb/MdbSecondaryNav';
import { fetchInstances, fetchInstancesRange, fetchMuscleRecovery } from '../../services/workoutService';
import {
  buildDayStrip, sequenceOf, targetLoadKg, totalSets, groupInstancesByDate, flattenInstances, parseIsoLocal,
  dayPermissions, monthBounds, monthTitle, isoDate, relativeDateTime,
} from '../../utils/mdbWorkout';

export default function MdbWorkoutCalendarScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [instances, setInstances] = useState({ today: [], upcoming: [], history: [] });
  const [recovery, setRecovery] = useState([]);
  const [selectedIso, setSelectedIso] = useState(() => isoDate(new Date()));
  // Month browsing: `monthIso` is any date inside the month on show, and
  // `monthRows` holds instances fetched for that window (the default buckets
  // only cover today / next 7 / last 30).
  // The strip's window is anchored separately from the selection: tapping a day
  // in the strip must not re-centre it under the member's finger. Only the month
  // picker moves the anchor.
  const [anchorIso, setAnchorIso] = useState(() => isoDate(new Date()));
  const [monthIso, setMonthIso] = useState(() => isoDate(new Date()));
  const [monthRows, setMonthRows] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [openMuscle, setOpenMuscle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [inst, rec] = await Promise.allSettled([fetchInstances(), fetchMuscleRecovery()]);
    setInstances(inst.status === 'fulfilled' && inst.value ? inst.value : { today: [], upcoming: [], history: [] });
    setRecovery(rec.status === 'fulfilled' ? (rec.value || []) : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Pull a month's instances on demand, so any date the member browses to has
  // real data behind it rather than an empty cell.
  //
  // The window is padded by a week either side: the 7-day strip is centred on
  // the picked date, so anchoring on the 1st or the 31st makes it straddle the
  // neighbouring month. Without the padding those days would render as rest
  // days purely because they were never fetched.
  const monthReq = useRef(0);
  const loadMonth = useCallback(async (iso) => {
    const { from, to } = monthBounds(iso);
    const req = ++monthReq.current;
    setMonthLoading(true);
    try {
      const rows = await fetchInstancesRange(padIso(from, -7), padIso(to, 7));
      // Stepping months quickly can land responses out of order; only the most
      // recent request may write, or an older month would overwrite the new one.
      if (req === monthReq.current) setMonthRows(rows || []);
    } catch {
      if (req === monthReq.current) setMonthRows([]); // strip still renders from the default buckets
    } finally {
      if (req === monthReq.current) setMonthLoading(false);
    }
  }, []);

  const openPicker = useCallback(() => {
    setPickerOpen(true);
    loadMonth(monthIso);
  }, [loadMonth, monthIso]);

  const changeMonth = useCallback((iso) => {
    setMonthIso(iso);
    loadMonth(iso);
  }, [loadMonth]);

  const pickDate = useCallback((iso) => {
    setSelectedIso(iso);
    setAnchorIso(iso);
    setMonthIso(iso);
    setPickerOpen(false);
  }, []);

  // Merge the default buckets with anything fetched for the browsed month.
  const allRows = useMemo(
    () => [...flattenInstances(instances), ...monthRows],
    [instances, monthRows],
  );
  const byDate = useMemo(() => groupInstancesByDate(allRows), [allRows]);
  const days = useMemo(
    () => buildDayStrip(allRows, new Date(), anchorIso),
    [allRows, anchorIso],
  );
  const selectedDay = days.find((d) => d.iso === selectedIso)
    || days.find((d) => d.iso === anchorIso)
    || days.find((d) => d.isToday);
  const perms = dayPermissions(selectedDay);
  const workout = selectedDay?.instances?.[0] || null;

  const sequence = useMemo(() => (workout ? sequenceOf(workout) : []), [workout]);
  const isCompleted = workout?.status === 'completed' || workout?.status === 'partial';

  // The strip only ever shows the five muscles this session targets; the full
  // ten-group board lives on screen 20.
  const targetMuscles = useMemo(() => {
    if (!recovery.length) return [];
    if (!sequence.length) return recovery.slice(0, 5);
    const hit = new Set();
    sequence.forEach((ex) => {
      if (ex.muscleGroupPrimary) hit.add(ex.muscleGroupPrimary);
      if (ex.muscleGroupSecondary) hit.add(ex.muscleGroupSecondary);
    });
    const focused = recovery.filter((m) => hit.has(m.muscleGroup));
    return focused.length ? focused : recovery.slice(0, 5);
  }, [recovery, sequence]);

  const targetLoad = targetLoadKg(sequence);
  const sets = totalSets(sequence);

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      {/* ── Fixed: floating back pill + month header (52pt) ──────────────── */}
      <View style={[s.header, { marginTop: insets.top }]}>
        <BackPill onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs'))} />
        <TouchableOpacity
          style={s.monthChip}
          activeOpacity={0.7}
          onPress={openPicker}
          accessibilityRole="button"
          accessibilityLabel="Choose a month"
        >
          <Text style={s.monthText}>{monthTitle(selectedIso)}</Text>
          <MdbIcon name="chevron-down" size={14} color={MC.textTertiary} />
        </TouchableOpacity>
        <View style={s.headerSpacer} />
      </View>

      {/* ── Fixed: 7-day strip ───────────────────────────────────────────── */}
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
          {/* Insights / Nutrition / Recovery live up here rather than buried
              in a chip row at the foot of the page — they're the surfaces
              that give the training itself meaning. */}
          <MdbSecondaryNav navigation={navigation} showNutrition={true} />

          {/* ── TODAY'S WORKOUT CARD (view/schedule only — logging lives on Home) */}
          {workout ? (
            <WorkoutDayCard
              workout={workout}
              readOnly
              readOnlyReason={selectedDay?.isToday ? null : perms.reason}
              onViewCompleted={() => navigation.navigate('MdbWorkoutSummary', { workoutLogId: workout.id })}
            />
          ) : (
            <WorkoutEmptyState
              variant="pt"
              pastLabel={selectedDay?.isToday
                ? 'No workout assigned for today.'
                : `No workout on ${dayLabel(selectedDay)}.`}
            />
          )}

          {/* ── EXERCISE SEQUENCE ──────────────────────────────────────── */}
          {sequence.length > 0 && (
            <View>
              <View style={s.sectionHead}>
                <View style={s.sectionHeadLeft}>
                  <Text style={s.sectionLabel}>EXERCISE SEQUENCE</Text>
                  <Text style={s.sectionMeta}>
                    {String(sets).padStart(2, '0')} Sets Plan
                  </Text>
                </View>
                {targetLoad != null && (
                  <Text style={s.sectionRight}>Target Load: {targetLoad.toLocaleString()} kg</Text>
                )}
              </View>

              <LuxuryCard style={s.sequenceCard}>
                {sequence.map((ex, i) => {
                  const done = isCompleted || ex.completed;
                  return (
                    <TouchableOpacity
                      key={`${ex.exerciseId}-${i}`}
                      style={[s.exRow, i > 0 && s.exRowDivider]}
                      activeOpacity={0.75}
                      onPress={() => navigation.navigate('MdbExerciseDetail', {
                        exerciseId: ex.exerciseId, name: ex.name,
                      })}
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

          {/* ── TARGET MUSCLE RECOVERY ─────────────────────────────────── */}
          {targetMuscles.length > 0 && (
            <View>
              <View style={s.sectionHead}>
                <View style={s.sectionHeadLeft}>
                  <Text style={s.recoveryLabel}>TARGET MUSCLE RECOVERY</Text>
                  <View style={s.liveBadge}><Text style={s.liveText}>LIVE</Text></View>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('MdbMuscleRecovery')} activeOpacity={0.7}>
                  <Text style={s.sectionRight}>Tap for Detail →</Text>
                </TouchableOpacity>
              </View>

              <MuscleRecoveryStrip
                muscles={targetMuscles}
                onSelect={(m) => setOpenMuscle({
                  ...m,
                  lastTrainedLabel: relativeDateTime(m.lastTrainedAt),
                })}
              />
            </View>
          )}

          <BrandFooter note="Private PT Agenda" />
          <View style={{ height: MS.bottomRoom }} />
        </ScrollView>
      )}

      <MdbMonthPicker
        visible={pickerOpen}
        monthIso={monthIso}
        selectedIso={selectedIso}
        byDate={byDate}
        loading={monthLoading}
        onMonthChange={changeMonth}
        onSelect={pickDate}
        onClose={() => setPickerOpen(false)}
      />

      <MuscleDetailSheet muscle={openMuscle} onClose={() => setOpenMuscle(null)} />
    </View>
  );
}

/** "Fri 12 Sep" for the rest-day line on a browsed date. */
function dayLabel(day) {
  if (!day) return 'this date';
  const d = new Date(`${day.iso}T00:00:00`);
  return isNaN(d.getTime())
    ? 'this date'
    : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Shift an ISO date by N days, for padding a fetch window. */
function padIso(iso, days) {
  const d = parseIsoLocal(iso);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MC.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: MS.hMargin,
  },
  headerSpacer: { width: 40, height: 40 },
  monthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: MR.pill,
  },
  monthText: { fontFamily: MF.medium, fontSize: 13, letterSpacing: 0.3, color: MC.textSecondary },

  scroll: { paddingTop: 16, paddingHorizontal: MS.hMargin, gap: 20 },

  /* Section headers */
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10, paddingHorizontal: 2,
  },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionLabel: {
    fontFamily: MF.semibold, fontSize: 11, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  recoveryLabel: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  sectionMeta: { fontFamily: MF.medium, fontSize: 11, color: MC.textSecondary, fontVariant: ['tabular-nums'] },
  sectionRight: { fontFamily: MF.medium, fontSize: 10, letterSpacing: 0.2, color: MC.textTertiary },
  liveBadge: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: MR.xs,
    backgroundColor: 'rgba(6,180,213,0.10)',
    borderWidth: 1, borderColor: 'rgba(6,180,213,0.20)',
  },
  liveText: { fontFamily: MF.medium, fontSize: 9, color: MC.cyan },

  /* Exercise sequence */
  sequenceCard: { overflow: 'hidden' },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  exRowDivider: { borderTopWidth: 1, borderTopColor: MC.cardBorder },
  exBody: { flex: 1, minWidth: 0 },
  exName: { fontFamily: MF.medium, fontSize: 14, color: MC.text },
  exTarget: {
    fontFamily: MF.mono, fontSize: 12, color: MC.textSecondary,
    fontVariant: ['tabular-nums'], marginTop: 2,
  },
  exDone: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderWidth: 1, borderColor: 'rgba(245,166,35,0.40)',
    alignItems: 'center', justifyContent: 'center',
  },
  exPending: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(142,130,141,0.5)',
  },
});
