/**
 * Screen 23 — Redesigned Dashboard.
 * Port of `screen_23_home_dashboard.html`.
 *
 * This is the Activity Dashboard's replacement (not the Home hub): fixed 56pt
 * greeting bar, a scrolling stack, and the sticky studio-access bar.
 *
 * Stack order, per the pack:
 *   announcement bar · training week + streak · weekly recap (Sun/Mon) ·
 *   active-calories card · biometric telemetry · today's activity (collapsible) ·
 *   progress entry · today's workout
 *
 * ⚠️ The biometric telemetry row is the wearable block. `/member/dashboard`
 * still reports wearableState: 'none' (Part C is unbuilt), so per the build
 * instruction it renders with the pack's placeholder readings behind a DEMO
 * marker rather than being deleted. PRD B.1's real rule is zero scaffolding —
 * when wearables ship, gate this on wearableState !== 'none' and it disappears
 * cleanly for members with no device. See WEARABLE_DEMO below.
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
import { fetchInstances } from '../../services/workoutService';
import { useAuthStore } from '../../store/authStore';
import { useAnnouncementStore } from '../../store/announcementStore';
import { sequenceOf, estimatedMinutes, isoDate } from '../../utils/mdbWorkout';

// Flip to false the moment real telemetry exists; the row then reads from
// dashboard.wearableState + dashboard.health and hides itself when absent.
const WEARABLE_DEMO = true;
const DEMO_METRICS = [
  { value: '58 bpm', label: 'Resting HR' },
  { value: '42 ms', label: 'HRV (SDNN)' },
  { value: '7h 22m', label: 'Sleep' },
];

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function MdbDashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const unreadCount = useAnnouncementStore((s) => s.unreadCount);

  const [data, setData] = useState(null);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [logOpen, setLogOpen] = useState(true);
  const [recapDismissed, setRecapDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const dismissRecap = async () => {
    setRecapDismissed(true);
    if (data?.weeklyRecap?.weekStart) {
      await AsyncStorage.setItem(`mdb_recap_${data.weeklyRecap.weekStart}`, '1').catch(() => {});
    }
  };

  const firstName = user?.firstName || user?.fullName?.split(' ')[0] || 'Athlete';
  const initial = firstName.charAt(0).toUpperCase();
  const cal = data?.combinedCaloriesToday || { total: 0, workout: 0, activity: 0 };
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
            {buildWeek(data?.heatmap).map((d, i) => (
              <View
                key={i}
                style={[
                  s.weekDay,
                  d.trained && s.weekDayOn,
                  d.isToday && s.weekDayToday,
                ]}
              >
                <Text style={[s.weekDow, d.trained && s.weekDowOn, d.isToday && s.weekDowToday]}>
                  {DOW[i]}
                </Text>
                <Text style={[s.weekMark, d.trained && s.weekDowOn, d.isToday && s.weekDowToday]}>
                  {d.trained ? '●' : '○'}
                </Text>
              </View>
            ))}
          </View>
        </LuxuryCard>

        {/* ── Weekly recap (Sun/Mon, dismissible) ────────────────────────── */}
        {recap?.show && !recapDismissed && (
          <MdbWeeklyRecapCard
            recap={recap}
            wellness={data?.wellnessAvg}
            onDismiss={dismissRecap}
          />
        )}

        {/* ── Active calories today ──────────────────────────────────────── */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('MdbAnalytics')}>
          <LuxuryCard style={s.calCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>ACTIVE TODAY</Text>
              <View style={s.calValueRow}>
                <Text style={s.calValue}>{cal.total.toLocaleString()}</Text>
                <Text style={s.calUnit}>kcal</Text>
              </View>
              <Text style={s.calSub}>{calorieBreakdown(data)}</Text>
            </View>
            <View style={s.calIcon}>
              <MdbIcon name="flame" size={18} color={MC.warm} />
            </View>
          </LuxuryCard>
        </TouchableOpacity>

        {/* ── Biometric telemetry (demo until Part C) ────────────────────── */}
        {WEARABLE_DEMO && (
          <View style={s.telemetry}>
            <View style={s.telemetryHead}>
              <Text style={s.eyebrow}>BIOMETRIC TELEMETRY</Text>
              <View style={s.demoBadge}><Text style={s.demoText}>DEMO DATA</Text></View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.metricRail}>
              {DEMO_METRICS.map((m) => (
                <View key={m.label} style={s.metricCard}>
                  <Text style={s.metricValue}>{m.value}</Text>
                  <Text style={s.metricLabel}>{m.label}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Today's activity (collapsible) ─────────────────────────────── */}
        <LuxuryCard style={s.logCard}>
          <TouchableOpacity style={s.logHead} onPress={() => setLogOpen((v) => !v)} activeOpacity={0.75}>
            <View style={s.logHeadLeft}>
              <Text style={s.logTitle}>Today's Activity</Text>
              <Text style={s.logCount}>
                {log.length} event{log.length === 1 ? '' : 's'}
              </Text>
            </View>
            <MdbIcon name={logOpen ? 'chevron-down' : 'chevron-right'} size={14} color={MC.textTertiary} />
          </TouchableOpacity>

          {logOpen && (
            log.length === 0 ? (
              <Text style={s.logEmpty}>Nothing logged today yet.</Text>
            ) : (
              <View style={s.logList}>
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
            )
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

function calorieBreakdown(data) {
  const log = data?.activityLogToday || [];
  const workouts = log.filter((r) => r.type === 'workout').length;
  const activities = log.filter((r) => r.type === 'activity').length;
  if (!workouts && !activities) return 'No sessions logged yet';
  return [
    workouts ? `${workouts} workout${workouts === 1 ? '' : 's'}` : null,
    activities ? `${activities} activity${activities === 1 ? '' : 'ies'}` : null,
  ].filter(Boolean).join(' · ');
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
  weekDow: { fontFamily: MF.mono, fontSize: 10, color: MC.textTertiary },
  weekDowOn: { color: MC.cyan },
  weekDowToday: { color: MC.white, fontFamily: MF.monoSemi },
  weekMark: { fontFamily: MF.mono, fontSize: 10, color: MC.textTertiary },

  /* Calories */
  calCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  calValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 },
  calValue: {
    fontFamily: MF.monoSemi, fontSize: 28, color: MC.text,
    fontVariant: ['tabular-nums'],
  },
  calUnit: { fontFamily: MF.regular, fontSize: 14, color: MC.textSecondary },
  calSub: { fontFamily: MF.regular, fontSize: 11, color: MC.textSecondary, marginTop: 2 },
  calIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(245,166,35,0.10)',
    borderWidth: 1, borderColor: 'rgba(245,166,35,0.30)',
    alignItems: 'center', justifyContent: 'center',
  },

  /* Telemetry */
  telemetry: { gap: 6 },
  telemetryHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  demoBadge: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: MR.xs,
    backgroundColor: 'rgba(245,166,35,0.12)',
  },
  demoText: { fontFamily: MF.semibold, fontSize: 8, letterSpacing: 0.8, color: MC.warm },
  metricRail: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  metricCard: {
    width: 100, padding: 10, alignItems: 'center',
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder, borderRadius: MR.card,
  },
  metricValue: {
    fontFamily: MF.monoSemi, fontSize: 16, color: MC.text,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontFamily: MF.regular, fontSize: 9, letterSpacing: 0.8,
    textTransform: 'uppercase', color: MC.textTertiary, marginTop: 2,
  },

  /* Activity log */
  logCard: { padding: 12, gap: 8 },
  logHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logTitle: { fontFamily: MF.semibold, fontSize: 13, color: MC.text },
  logCount: {
    fontFamily: MF.mono, fontSize: 10, color: MC.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  logEmpty: { fontFamily: MF.regular, fontSize: 11, color: MC.textTertiary, paddingTop: 4 },
  logList: { paddingTop: 4 },
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
