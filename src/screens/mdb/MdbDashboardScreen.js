/**
 * Screen 23 — Redesigned Dashboard.
 * Port of `screen_23_home_dashboard.html`.
 *
 * This is the Activity Dashboard's replacement (not the Home hub): fixed 56pt
 * greeting bar, a scrolling stack, and the sticky studio-access bar.
 *
 * Stack order, per the pack:
 *   announcement bar · training week + streak · weekly recap (Sun/Mon) ·
 *   day detail (collapsible) · progress entry · today's workout
 *
 * The active-calories card and biometric telemetry that used to live here
 * moved to `MdbHealthMetricsScreen` (round 4) — Home's CALORIES BURNED card
 * is now the entry point for that content, so it isn't duplicated on both
 * screens.
 *
 * Round 5: the training-week pills are now tappable, and "Today's Activity"
 * became "Day Detail" — real stats (duration/volume/sets/calories) plus a
 * per-exercise volume bar graph for whichever day is selected, built from
 * that day's actual workout_logs/set_logs. Today additionally keeps its
 * richer mixed activity feed (workouts + cafe/gym-class events) below the
 * graph, since that per-event log only exists for "today" on the backend.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

import { MC, MG, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import MdbWeeklyRecapCard from '../../components/mdb/MdbWeeklyRecapCard';
import { LuxuryCard } from '../../components/mdb/MdbPrimitives';
import { fetchDashboard } from '../../services/dashboardService';
import { fetchInstances, fetchInstancesRange, fetchWorkoutDetail } from '../../services/workoutService';
import { useAuthStore } from '../../store/authStore';
import { useAnnouncementStore } from '../../store/announcementStore';
import { sequenceOf, estimatedMinutes, isoDate } from '../../utils/mdbWorkout';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function MdbDashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const unreadCount = useAnnouncementStore((s) => s.unreadCount);

  const todayIso = isoDate(new Date());

  const [data, setData] = useState(null);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [logOpen, setLogOpen] = useState(true);
  const [recapDismissed, setRecapDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // The training-week strip below is tappable — this is the day whose
  // exercises/volume/calories the Day Detail card (and its bar graph) shows.
  const [selectedIso, setSelectedIso] = useState(todayIso);
  const [dayDetail, setDayDetail] = useState(null);
  const [dayLoading, setDayLoading] = useState(true);

  const load = useCallback(async () => {
    const [dash, inst] = await Promise.allSettled([fetchDashboard('week'), fetchInstances()]);
    const d = dash.status === 'fulfilled' ? dash.value : null;
    setData(d);
    setTodayWorkout(inst.status === 'fulfilled' ? (inst.value?.today || [])[0] || null : null);

    if (d?.weeklyRecap?.weekStart) {
      const seen = await AsyncStorage.getItem(`mdb_recap_${d.weeklyRecap.weekStart}`);
      setRecapDismissed(seen === '1');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadDay = useCallback(async (iso) => {
    setDayLoading(true);
    try {
      const rows = await fetchInstancesRange(iso, iso);
      const completed = (rows || []).filter((r) => r.status === 'completed' || r.status === 'partial');
      const details = await Promise.all(completed.map((r) => fetchWorkoutDetail(r.id)));
      setDayDetail(aggregateDayDetail(details));
    } catch {
      setDayDetail(aggregateDayDetail([]));
    } finally {
      setDayLoading(false);
    }
  }, []);

  useEffect(() => { loadDay(selectedIso); }, [selectedIso, loadDay]);

  const dismissRecap = async () => {
    setRecapDismissed(true);
    if (data?.weeklyRecap?.weekStart) {
      await AsyncStorage.setItem(`mdb_recap_${data.weeklyRecap.weekStart}`, '1').catch(() => {});
    }
  };

  const firstName = user?.firstName || user?.fullName?.split(' ')[0] || 'Athlete';
  const initial = firstName.charAt(0).toUpperCase();
  const log = data?.activityLogToday || [];
  const streak = data?.streak || {};
  const recap = data?.weeklyRecap;

  const workoutSequence = todayWorkout ? sequenceOf(todayWorkout) : [];
  const workoutMins = estimatedMinutes(workoutSequence);

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

      {/* ── 56pt greeting bar ────────────────────────────────────────────── */}
      <View style={[s.greetBar, { marginTop: insets.top }]}>
        <View style={s.greetLeft}>
          <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.avatarRing}>
            <View style={s.avatarInner}>
              <Text style={s.avatarText}>{initial}</Text>
            </View>
          </LinearGradient>
          <View>
            <Text style={s.greeting}>{greeting()}</Text>
            <Text style={s.name}>{firstName}</Text>
          </View>
        </View>

        <TouchableOpacity style={s.bellBtn} onPress={() => navigation.push('Notifications')} activeOpacity={0.75}>
          <MdbIcon name="info" size={16} color={MC.textSecondary} />
          {unreadCount > 0 && <View style={s.bellDot} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
            tintColor={MC.violetLight}
          />
        }
      >
        {/* ── Training week + streak ─────────────────────────────────────── */}
        <LuxuryCard style={s.weekCard}>
          <View style={s.weekHead}>
            <Text style={s.weekLabel}>TRAINING WEEK</Text>
            <Text style={s.weekStreak}>
              ★ {streak.workoutCurrent || streak.checkinCurrent || 0}-DAY STREAK
            </Text>
          </View>
          <View style={s.weekRow}>
            {buildWeek(data?.heatmap).map((d, i) => {
              const selected = d.iso === selectedIso;
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    s.weekDay,
                    d.trained && s.weekDayOn,
                    d.isToday && s.weekDayToday,
                    selected && s.weekDaySelected,
                  ]}
                  onPress={() => setSelectedIso(d.iso)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.weekDow, d.trained && s.weekDowOn, d.isToday && s.weekDowToday]}>
                    {DOW[i]}
                  </Text>
                  <Text style={[s.weekMark, d.trained && s.weekDowOn, d.isToday && s.weekDowToday]}>
                    {d.trained ? '●' : '○'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={s.weekHint}>Tap a day to see what you logged</Text>
        </LuxuryCard>

        {/* ── Weekly recap (Sun/Mon, dismissible) ────────────────────────── */}
        {recap?.show && !recapDismissed && (
          <MdbWeeklyRecapCard
            recap={recap}
            wellness={data?.wellnessAvg}
            onDismiss={dismissRecap}
          />
        )}

        {/* ── Day detail (collapsible) — whichever day is tapped above ────── */}
        <LuxuryCard style={s.logCard}>
          <TouchableOpacity style={s.logHead} onPress={() => setLogOpen((v) => !v)} activeOpacity={0.75}>
            <View style={s.logHeadLeft}>
              <Text style={s.logTitle}>{dayLabel(selectedIso, todayIso)}</Text>
              {!dayLoading && (
                <Text style={s.logCount}>
                  {dayDetail.exerciseCount} exercise{dayDetail.exerciseCount === 1 ? '' : 's'} · {dayDetail.setsDone} set{dayDetail.setsDone === 1 ? '' : 's'}
                </Text>
              )}
            </View>
            <MdbIcon name={logOpen ? 'chevron-down' : 'chevron-right'} size={14} color={MC.textTertiary} />
          </TouchableOpacity>

          {logOpen && (
            dayLoading ? (
              <View style={s.dayLoading}><ActivityIndicator color={MC.violetLight} size="small" /></View>
            ) : dayDetail.exerciseBars.length === 0 ? (
              <Text style={s.logEmpty}>Nothing logged this day.</Text>
            ) : (
              <>
                <View style={s.dayStatRow}>
                  <DayStat value={dayDetail.durationMinutes} unit="min" label="Duration" />
                  <DayStat value={dayDetail.volumeKg.toLocaleString()} unit="kg" label="Volume" />
                  <DayStat value={dayDetail.setsDone} label="Sets" />
                  <DayStat value={dayDetail.calories} unit="kcal" label="Calories" />
                </View>

                {/* The graph — one bar per exercise, longest (heaviest volume) first */}
                <View style={s.barList}>
                  {dayDetail.exerciseBars.map((ex) => (
                    <View key={ex.name} style={s.barRow}>
                      <Text style={s.barLabel} numberOfLines={1}>{ex.name}</Text>
                      <View style={s.barTrack}>
                        <View style={[s.barFill, { width: `${(ex.volume / dayDetail.maxVolume) * 100}%` }]} />
                      </View>
                      <Text style={s.barValue}>{Math.round(ex.volume).toLocaleString()} kg</Text>
                    </View>
                  ))}
                </View>
              </>
            )
          )}

          {/* Today keeps its richer mixed log (workouts + cafe/gym-class activity) —
              that per-event feed only exists for "today" on the backend. */}
          {logOpen && selectedIso === todayIso && log.length > 0 && (
            <View style={[s.logList, s.logListDivider]}>
              {log.map((row, i) => (
                <View key={`${row.name}-${i}`} style={[s.logRow, i > 0 && s.logRowDivider]}>
                  <Text style={s.logName} numberOfLines={1}>{row.name}</Text>
                  <View style={s.logRight}>
                    <Text style={s.logStats}>
                      {row.minutes}m · {row.calories} kcal
                    </Text>
                    <Text style={[s.logSource, row.type === 'activity' && { color: MC.cyan }]}>
                      [{row.type === 'workout' ? 'App' : 'Activity'}]
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </LuxuryCard>

        {/* ── Progress entry ─────────────────────────────────────────────── */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('MdbProgressTracker')}>
          <LuxuryCard style={s.progressCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.progressTitle}>Progress</Text>
              <Text style={s.progressSub}>{progressLabel(data?.progress)}</Text>
            </View>
            <MdbIcon name="arrow-right" size={16} color={MC.textTertiary} />
          </LuxuryCard>
        </TouchableOpacity>

        {/* ── Today's workout ────────────────────────────────────────────── */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('MdbTrainingHub')}>
          <LuxuryCard style={s.workoutCard}>
            <View style={s.workoutEdge} />
            <View style={s.workoutHead}>
              <Text style={s.eyebrow}>TODAY'S WORKOUT</Text>
              <Text style={s.workoutState}>{workoutState(todayWorkout)}</Text>
            </View>
            <Text style={s.workoutTitle} numberOfLines={1}>
              {todayWorkout?.snapshot?.name || 'Rest day'}
            </Text>
            <Text style={s.workoutMeta}>
              {todayWorkout
                ? [
                    `${workoutSequence.length} exercise${workoutSequence.length === 1 ? '' : 's'}`,
                    workoutMins ? `${workoutMins} min` : null,
                    todayWorkout.trainerName ? `Coach ${todayWorkout.trainerName}` : null,
                  ].filter(Boolean).join(' · ')
                : 'Nothing scheduled — open training to plan one'}
            </Text>
          </LuxuryCard>
        </TouchableOpacity>

        <View style={{ height: MS.bottomRoom }} />
      </ScrollView>

      {/* ── Sticky studio access bar ─────────────────────────────────────── */}
      <View style={[s.accessBar, { paddingBottom: 8 + insets.bottom }]}>
        <View>
          <Text style={s.accessLabel}>STUDIO ACCESS</Text>
          <Text style={s.accessName}>Maison Flagship</Text>
        </View>
        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('Access')}>
          <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.checkInBtn}>
            <Text style={s.checkInText}>CHECK IN</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'GOOD MORNING';
  if (h < 17) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
}

/** Mon–Sun of the current week, marked from the dashboard's 35-day heatmap. */
function buildWeek(heatmap) {
  const trained = new Set(
    (heatmap || []).filter((h) => h.level > 0).map((h) => String(h.date).slice(0, 10)),
  );
  const now = new Date();
  const todayIdx = (now.getDay() + 6) % 7; // Mon=0
  const monday = new Date(now);
  monday.setDate(now.getDate() - todayIdx);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = isoDate(d);
    return { iso, isToday: i === todayIdx, trained: trained.has(iso) };
  });
}

/** "Today" / "Yesterday" / "Wed, 10 Sep" for the Day Detail card's header. */
function dayLabel(iso, todayIso) {
  if (iso === todayIso) return 'Today';
  const y = new Date(`${todayIso}T00:00:00`);
  y.setDate(y.getDate() - 1);
  if (iso === isoDate(y)) return 'Yesterday';
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Everything the Day Detail card needs for one calendar day, built from that
 * day's completed workout_logs the same way the share card aggregates a
 * multi-workout day — plus a per-exercise volume breakdown for the bar graph.
 */
function aggregateDayDetail(details) {
  const allSets = details.flatMap((d) => d.sets || []);
  const allExercises = details.flatMap((d) => d.snapshot?.exercises || []);
  const nameOf = (id) => allExercises.find((e) => e.exerciseId === id)?.name || 'Exercise';

  const byExercise = new Map();
  for (const st of allSets) {
    const vol = (Number(st.actualWeight) || 0) * (Number(st.actualReps) || 0);
    const cur = byExercise.get(st.exerciseId) || { name: nameOf(st.exerciseId), volume: 0 };
    cur.volume += vol;
    byExercise.set(st.exerciseId, cur);
  }
  const exerciseBars = [...byExercise.values()].sort((a, b) => b.volume - a.volume);
  const maxVolume = Math.max(1, ...exerciseBars.map((e) => e.volume));

  return {
    durationMinutes: details.reduce((n, d) => n + (Number(d.durationMinutes) || 0), 0),
    volumeKg: Math.round(details.reduce((n, d) => n + (Number(d.totalVolume) || 0), 0)),
    setsDone: allSets.length,
    exerciseCount: new Set(allExercises.map((e) => e.exerciseId)).size
      || new Set(allSets.map((x) => x.exerciseId)).size,
    calories: Math.round(details.reduce((n, d) => n + (Number(d.finalCalorieValue) || 0), 0)),
    exerciseBars,
    maxVolume,
  };
}

function progressLabel(progress) {
  if (!progress) return 'Log your weight';
  const parts = [];
  if (progress.latestWeightKg != null) {
    const when = progress.latestWeightDate
      ? new Date(progress.latestWeightDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      : null;
    parts.push(`Last logged: ${progress.latestWeightKg} kg${when ? ` · ${when}` : ''}`);
  } else {
    parts.push('Log your weight');
  }
  if (progress.photoCount) parts.push(`${progress.photoCount} photo${progress.photoCount === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

function workoutState(w) {
  if (!w) return 'REST';
  if (w.status === 'completed' || w.status === 'partial') return 'DONE';
  if (w.status === 'in_progress') return 'IN PROGRESS';
  return 'READY';
}

/* ── One cell of the Day Detail stat row ─────────────────────────────────── */
function DayStat({ value, unit, label }) {
  return (
    <View style={s.dayStat}>
      <Text style={s.dayStatValue}>
        {value}{!!unit && <Text style={s.dayStatUnit}> {unit}</Text>}
      </Text>
      <Text style={s.dayStatLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MC.bg },
  center: { alignItems: 'center', justifyContent: 'center' },

  greetBar: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: MS.hMargin,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  greetLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarRing: { width: 32, height: 32, borderRadius: 16, padding: 1 },
  avatarInner: {
    flex: 1, borderRadius: 16, backgroundColor: '#100D18',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: MF.semibold, fontSize: 12, color: MC.text },
  greeting: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  name: { fontFamily: MF.semibold, fontSize: 14, color: MC.text },
  bellBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute', top: 6, right: 7,
    width: 6, height: 6, borderRadius: 3, backgroundColor: MC.warm,
  },

  scroll: { paddingHorizontal: MS.hMargin, paddingTop: 12, gap: 14 },
  eyebrow: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
  },

  /* Training week */
  weekCard: { padding: 12, gap: 8 },
  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekLabel: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.text,
  },
  weekStreak: {
    fontFamily: MF.monoSemi, fontSize: 11, color: MC.warm,
    fontVariant: ['tabular-nums'],
  },
  weekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  weekDay: { width: 28, paddingVertical: 4, borderRadius: MR.sm, alignItems: 'center' },
  weekDayOn: {
    backgroundColor: 'rgba(120,61,236,0.20)',
    borderWidth: 1, borderColor: 'rgba(120,61,236,0.40)',
  },
  weekDayToday: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },
  weekDaySelected: { borderWidth: 1, borderColor: MC.cyan },
  weekDow: { fontFamily: MF.mono, fontSize: 10, color: MC.textTertiary },
  weekDowOn: { color: MC.cyan },
  weekDowToday: { color: MC.white, fontFamily: MF.monoSemi },
  weekMark: { fontFamily: MF.mono, fontSize: 10, color: MC.textTertiary },
  weekHint: {
    fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary,
    textAlign: 'center', paddingTop: 6,
  },

  /* Day detail */
  logCard: { padding: 12, gap: 8 },
  logHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logTitle: { fontFamily: MF.semibold, fontSize: 13, color: MC.text },
  logCount: {
    fontFamily: MF.mono, fontSize: 10, color: MC.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  logEmpty: { fontFamily: MF.regular, fontSize: 11, color: MC.textTertiary, paddingTop: 4 },
  dayLoading: { paddingVertical: 12, alignItems: 'center' },

  dayStatRow: {
    flexDirection: 'row', paddingTop: 8, marginTop: 4,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
  },
  dayStat: { flex: 1, alignItems: 'center' },
  dayStatValue: {
    fontFamily: MF.monoSemi, fontSize: 15, color: MC.text,
    fontVariant: ['tabular-nums'],
  },
  dayStatUnit: { fontFamily: MF.regular, fontSize: 10, color: MC.textSecondary },
  dayStatLabel: {
    fontFamily: MF.regular, fontSize: 9, letterSpacing: 0.6,
    textTransform: 'uppercase', color: MC.textTertiary, marginTop: 2,
  },

  barList: { paddingTop: 10, gap: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 92, fontFamily: MF.regular, fontSize: 10, color: MC.textSecondary },
  barTrack: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: MC.violet },
  barValue: {
    width: 56, textAlign: 'right', fontFamily: MF.mono, fontSize: 10,
    color: MC.textTertiary, fontVariant: ['tabular-nums'],
  },

  logList: { paddingTop: 4 },
  logListDivider: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  logRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, paddingVertical: 6,
  },
  logRowDivider: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  logName: { flex: 1, fontFamily: MF.regular, fontSize: 11, color: MC.text },
  logRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logStats: {
    fontFamily: MF.mono, fontSize: 11, color: MC.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  logSource: { fontFamily: MF.regular, fontSize: 9, color: MC.textTertiary },

  /* Progress */
  progressCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  progressTitle: { fontFamily: MF.semibold, fontSize: 13, color: MC.text },
  progressSub: { fontFamily: MF.regular, fontSize: 11, color: MC.textSecondary, marginTop: 2 },

  /* Today's workout */
  workoutCard: { padding: 16, paddingLeft: 18, gap: 6, overflow: 'hidden' },
  workoutEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, backgroundColor: MC.cyan },
  workoutHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  workoutState: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1,
    textTransform: 'uppercase', color: MC.cyan,
  },
  workoutTitle: { fontFamily: MF.semibold, fontSize: 15, color: MC.text },
  workoutMeta: { fontFamily: MF.regular, fontSize: 12, color: MC.textSecondary },

  /* Sticky access bar */
  accessBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: MS.hMargin, paddingTop: 10,
    backgroundColor: MC.bg,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  accessLabel: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  accessName: { fontFamily: MF.semibold, fontSize: 12, color: MC.text, marginTop: 2 },
  checkInBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: MR.button },
  checkInText: {
    fontFamily: MF.semibold, fontSize: 12, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.white,
  },
});
