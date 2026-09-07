import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Image, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../theme';
import { useAnnouncementStore } from '../../store/announcementStore';
import { useAuthStore } from '../../store/authStore';
import { useWalletStore } from '../../store/walletStore';
import { useChatStore } from '../../store/chatStore';
import { getSocket } from '../../services/socketService';
import { fetchTodaysPlan, fetchStreak, fetchInstances } from '../../services/workoutService';
import { getMyLeaderboardStats } from '../../services/leaderboardService';
import { fetchMyAttendance } from '../../services/gymService';
import { fetchMyTrials } from '../../services/trialService';
import ActiveOrderBar from '../../components/ActiveOrderBar';
import NotificationPermissionBanner from '../../components/NotificationPermissionBanner';

// Mockup accent palette (kept as literals — multi-colour KPI / quick-access tiles).
const AMBER = '#F59E0B';
const GOLD  = '#FFD700';
const CYAN  = '#00CED1';
const SILVER = '#C8C6C8';
const GREEN = '#4ADE80';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Friendly countdown for the upcoming-trial card ("in 2 days", "in 3 hrs").
function countdownLabel(iso) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'now';
  const days = Math.floor(diff / 86400000);
  if (days >= 1) return `in ${days} day${days > 1 ? 's' : ''}`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs >= 1) return `in ${hrs} hr${hrs > 1 ? 's' : ''}`;
  const mins = Math.max(1, Math.floor(diff / 60000));
  return `in ${mins} min`;
}

// Quick-access tiles → real routes.
// Icons mirror the Stitch design's Material Symbols exactly (MaterialIcons set).
const QUICK = [
  { label: 'ACTIVITIES', icon: 'fitness-center',       color: '#00BCD4', route: 'Activities' },
  { label: 'CAFE',       icon: 'local-cafe',           color: '#FFA000', route: 'Cafe', comingSoon: true },
  { label: 'RANKING',    icon: 'leaderboard',          color: GOLD,      route: 'Leaderboard' },
  { label: 'COMMUNITY',  icon: 'forum',                color: '#9C27B0', route: 'Community' },
  { label: 'TRAINERS',   icon: 'sports-martial-arts',  color: '#4CAF50', route: 'Trainers' },
  { label: 'BLOGS',      icon: 'menu-book',            color: '#4A90D9', route: 'BlogList' },
  { label: 'GAMING',     icon: 'sports-esports',       color: '#7C3AED', route: 'Gaming' },
];

// Dummy 7-day calorie bar heights (no calories service yet).
const CAL_BARS = [
  { h: 0.60, c: 'purple' },
  { h: 0.40, c: 'purple' },
  { h: 0.85, c: 'mix' },
  { h: 0.75, c: 'mix' },
  { h: 0.35, c: 'dim' },
  { h: 0.25, c: 'dim' },
  { h: 0.15, c: 'dim' },
];

export default function HomeScreen({ navigation }) {
  const unreadCount = useAnnouncementStore((s) => s.unreadCount);
  const user = useAuthStore((s) => s.user);
  const { balance, fetchBalance, setBalance } = useWalletStore();

  const [todaysPlan, setTodaysPlan] = useState(null);
  const [todayInstance, setTodayInstance] = useState(null);
  const [streakData, setStreakData] = useState(null);
  const [leaderboardStats, setLeaderboardStats] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [upcomingTrial, setUpcomingTrial] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Live wallet balance (fetch + socket).
  useEffect(() => {
    fetchBalance();
    if (user?.id) {
      const socket = getSocket();
      socket.emit('join:wallet', user.id);
      socket.on('wallet:balance_updated', ({ balance: newBalance }) => setBalance(newBalance));
      return () => { socket.off('wallet:balance_updated'); };
    }
  }, [user?.id]);

  const loadContent = useCallback(async () => {
    await Promise.all([
      fetchTodaysPlan()
        .then((data) => setTodaysPlan(data || null))
        .catch(() => setTodaysPlan(null)),
      fetchInstances()
        .then((data) => setTodayInstance((data?.today || [])[0] || null))
        .catch(() => setTodayInstance(null)),
      fetchStreak()
        .then((data) => setStreakData(data || null))
        .catch(() => setStreakData(null)),
      getMyLeaderboardStats()
        .then((data) => setLeaderboardStats(data || null))
        .catch(() => setLeaderboardStats(null)),
      fetchMyAttendance()
        .then((data) => setAttendance(data || null))
        .catch(() => setAttendance(null)),
      fetchMyTrials('upcoming')
        .then((res) => setUpcomingTrial((res.data?.data || [])[0] || null))
        .catch(() => setUpcomingTrial(null)),
    ]);
  }, []);

  useEffect(() => { loadContent(); }, [loadContent]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchBalance(), loadContent()]);
    setRefreshing(false);
  }, [fetchBalance, loadContent]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'GOOD MORNING';
    if (h < 17) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  };

  const firstName = user?.firstName || user?.fullName?.split(' ')[0] || 'Athlete';

  // ── Derived display values ────────────────────────────────────────────────
  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayDow = (now.getDay() + 6) % 7; // Mon=0 … Sun=6
  const monday = new Date(now);
  monday.setDate(now.getDate() - todayDow);
  const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // Real check-in days this week (a day lights up only on a gym check-in).
  const checkinDates = new Set((attendance?.logs || []).map((l) => String(l.date).slice(0, 10)));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { date: d.getDate(), isToday: i === todayDow, attended: checkinDates.has(isoDate(d)) };
  });

  const currentStreak = streakData?.currentStreak ?? 0;
  const longestStreak = streakData?.longestStreak ?? 0;
  const clubRank = leaderboardStats?.rank ? `#${leaderboardStats.rank}` : '—';
  const pointsValue = leaderboardStats?.points != null ? leaderboardStats.points.toLocaleString() : '—';
  const monthVisits = attendance?.monthCount != null ? `${attendance.monthCount} Visit${attendance.monthCount === 1 ? '' : 's'}` : '—';

  // Today's workout — real dated instance first, else a weekly-plan match, else rest day.
  const todayWorkout = todayInstance
    ? {
        name: todayInstance.snapshot?.name || 'Workout',
        coach: todayInstance.trainerName || todayInstance.assignedByName || null,
        status: todayInstance.status,
        exCount: Array.isArray(todayInstance.snapshot?.exercises) ? todayInstance.snapshot.exercises.length : 0,
        instanceId: todayInstance.id,
        snapshot: todayInstance.snapshot,
      }
    : todaysPlan
    ? {
        name: todaysPlan.name,
        coach: todaysPlan.trainerName || todaysPlan.assignedByName || null,
        status: null,
        exCount: todaysPlan.exercises?.length || 0,
        planId: todaysPlan.id,
        plan: todaysPlan,
      }
    : null;
  const STATUS_LABEL = { assigned: 'Assigned', in_progress: 'In progress', completed: 'Completed', partial: 'Completed', missed: 'Missed', cancelled: 'Cancelled' };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Radial purple glow at top */}
      <LinearGradient
        colors={['rgba(127,41,130,0.15)', 'transparent']}
        style={styles.glow}
        pointerEvents="none"
      />

      {/* ── TOP APP BAR ─────────────────────────── */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.userName}>{firstName}</Text>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.topBtn} onPress={() => navigation.push('Notifications')}>
            <MaterialIcons name="notifications" size={24} color={COLORS.textSecondary} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarBtn} onPress={() => navigation.push('Profile')}>
            {user?.profilePhotoUrl ? (
              <Image source={{ uri: user.profilePhotoUrl }} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatarImg, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{firstName.charAt(0)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primaryLight} />
        }
      >
        {/* Re-checked on every foreground; renders nothing once permission is on. */}
        <NotificationPermissionBanner style={styles.permissionBanner} />

        {/* ── WEEKLY OVERVIEW STRIP ────────────────── */}
        <View style={styles.weekCard}>
          <View style={styles.weekHeader}>
            <View>
              <Text style={styles.eyebrow}>WEEKLY OVERVIEW</Text>
              <Text style={styles.weekMonth}>{monthLabel}</Text>
            </View>
            <View style={styles.streakChip}>
              <MaterialIcons name="local-fire-department" size={13} color={COLORS.primaryLight} />
              <Text style={styles.streakChipText}>{currentStreak} DAY STREAK</Text>
            </View>
          </View>
          <View style={styles.weekRow}>
            {weekDays.map((d, i) => (
              <View key={i} style={styles.weekDay}>
                <Text style={[styles.weekDow, d.isToday && { color: COLORS.primaryLight }]}>{DOW[i]}</Text>
                {d.isToday ? (
                  <LinearGradient
                    colors={['#F59E0B', '#FB923C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.weekToday}
                  >
                    <Text style={styles.weekAttendedNum}>{String(d.date).padStart(2, '0')}</Text>
                  </LinearGradient>
                ) : d.attended ? (
                  <View style={styles.weekAttended}>
                    <Text style={styles.weekAttendedNum}>{String(d.date).padStart(2, '0')}</Text>
                  </View>
                ) : (
                  <View style={styles.weekFuture}>
                    <Text style={styles.weekFutureNum}>{d.date}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* ── KPI GRID ─────────────────────────────── */}
        <View style={styles.kpiGrid}>
          <KpiCard label="LONGEST STREAK" value={`${longestStreak} Days`} icon="local-fire-department" color={COLORS.primaryLight} />
          <KpiCard label="THIS MONTH" value={monthVisits} icon="calendar-today" color={CYAN} />
          <KpiCard label="CLUB RANK" value={clubRank} icon="emoji-events" color={GOLD} />
          <KpiCard label="POINTS" value={pointsValue} icon="diamond" color={SILVER} />
        </View>

        {/* ── CALORIES BURNED (dummy) ──────────────── */}
        <View style={styles.calCard}>
          <View style={styles.calHeader}>
            <View>
              <Text style={styles.eyebrow}>CALORIES BURNED</Text>
              <Text style={styles.calValue}>2,840 <Text style={styles.calUnit}>kcal</Text></Text>
            </View>
            <Text style={styles.calDelta}>+12% vs last week</Text>
          </View>
          <View style={styles.calGraphWrap}>
          <View style={styles.calChart}>
            {CAL_BARS.map((b, i) => {
              const colors = b.c === 'purple'
                ? ['rgba(167,139,250,0.4)', 'rgba(167,139,250,0.85)']
                : b.c === 'mix'
                  ? ['rgba(167,139,250,0.4)', CYAN]
                  : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.12)'];
              return (
                <View key={i} style={styles.calBarSlot}>
                  <LinearGradient
                    colors={colors}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 0, y: 0 }}
                    style={[styles.calBar, { height: `${b.h * 100}%` }]}
                  />
                </View>
              );
            })}
          </View>
          <View style={styles.calLabels}>
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d, i) => (
              <Text key={d} style={[styles.calLabel, i === 3 && { color: COLORS.white }]}>{d}</Text>
            ))}
          </View>

            {/* Feature not live yet — blur the graph and mark it Coming Soon.
                Header text (CALORIES BURNED / kcal / +12%) stays sharp. */}
            <BlurView
              intensity={18}
              tint="dark"
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.comingSoonWrap} pointerEvents="none">
              <View style={styles.comingSoonBadge}>
                <MaterialIcons name="schedule" size={13} color={COLORS.white} />
                <Text style={styles.comingSoonText}>COMING SOON</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── BUILD COINS CARD ─────────────────────── */}
        <TouchableOpacity
          style={styles.coinsCard}
          activeOpacity={0.9}
          onPress={() => navigation.push('BuildCoinTransactions')}
        >
          <View style={styles.coinsLeft}>
            <View style={styles.coinsIcon}>
              <MaterialIcons name="toll" size={24} color={GOLD} />
            </View>
            <View>
              <Text style={styles.coinsLabel}>BUILD COINS</Text>
              <Text style={styles.coinsValue}>{(balance ?? 0).toLocaleString()}</Text>
            </View>
          </View>
          <View style={styles.coinsRight}>
            <Text style={styles.coinsHint}>Tap to view transactions</Text>
            <MaterialIcons name="chevron-right" size={18} color={COLORS.textMuted} />
          </View>
        </TouchableOpacity>

        {/* ── MY COACH ─────────────────────────────── */}
        <MyCoachCard navigation={navigation} />

        {/* ── QUICK ACCESS GRID ────────────────────── */}
        <View style={styles.quickGrid}>
          {QUICK.map((q) => {
            const cs = q.comingSoon;
            const tile = (
              <TouchableOpacity
                style={[styles.quickTile, cs && styles.quickTileDisabled]}
                activeOpacity={0.85}
                disabled={cs}
                onPress={() => navigation.push(q.route)}
              >
                <MaterialIcons
                  name={q.icon}
                  size={26}
                  color={q.color}
                  style={[styles.quickIcon, { textShadowColor: q.color }]}
                />
                <Text style={styles.quickLabel}>{q.label}</Text>
              </TouchableOpacity>
            );
            // Every tile gets an equal grid slot so tiles occupy identical space.
            return (
              <View key={q.label} style={styles.quickTileSlot}>
                {tile}
                {cs && (
                  <View style={styles.quickSoonWrap} pointerEvents="none">
                    <View style={styles.quickSoonBadge}>
                      <Text style={styles.quickSoonText}>COMING SOON</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ── TODAY'S WORKOUT ──────────────────────── */}
        <TouchableOpacity
          style={styles.workoutCard}
          activeOpacity={0.9}
          onPress={() => navigation.push('WorkoutHome')}
        >
          <View>
            <Text style={styles.workoutEyebrow}>TODAY'S WORKOUT</Text>
            {todayWorkout
              ? (todayWorkout.coach
                  ? <Text style={styles.workoutCoach}>Assigned by {todayWorkout.coach}</Text>
                  : <Text style={styles.workoutCoach}>Self workout</Text>)
              : <Text style={styles.workoutCoach}>Nothing scheduled</Text>}
          </View>
          <View style={{ marginTop: 8 }}>
            <Text style={styles.workoutTitle}>{todayWorkout ? todayWorkout.name : 'Rest Day'}</Text>
            <Text style={styles.workoutMeta}>
              {todayWorkout
                ? `${todayWorkout.exCount} exercise${todayWorkout.exCount === 1 ? '' : 's'}${todayWorkout.status ? ` · ${STATUS_LABEL[todayWorkout.status] || todayWorkout.status}` : ''}`
                : 'No workout assigned — recover and come back stronger'}
            </Text>
          </View>
          <View style={styles.workoutFooter}>
            <View style={styles.workoutLink}>
              <Text style={styles.workoutLinkText}>{todayWorkout ? 'VIEW WORKOUT' : 'OPEN WORKOUTS'}</Text>
              <MaterialIcons name="arrow-forward" size={13} color={COLORS.primaryLight} />
            </View>
          </View>
        </TouchableOpacity>

        {/* ── UPCOMING TRIAL (bottom of dashboard) ──────────── */}
        {upcomingTrial && (
          <TouchableOpacity
            style={styles.trialCard}
            activeOpacity={0.9}
            onPress={() => navigation.push('TrialDetail', { trialId: upcomingTrial.id })}
          >
            <View style={styles.trialTopRow}>
              <View style={styles.trialBadge}>
                <Ionicons name="flash" size={11} color={CYAN} />
                <Text style={styles.trialBadgeText}>TRIAL</Text>
              </View>
              <Text style={styles.trialCountdown}>{countdownLabel(upcomingTrial.scheduledAt)}</Text>
            </View>
            <View style={styles.trialBody}>
              {upcomingTrial.trainerPhoto ? (
                <Image source={{ uri: upcomingTrial.trainerPhoto }} style={styles.trialPhoto} />
              ) : (
                <View style={[styles.trialPhoto, styles.trialPhotoFallback]}>
                  <Text style={styles.trialInitials}>{(upcomingTrial.trainerName || 'C').slice(0, 2).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.trialCoach}>Coach {upcomingTrial.trainerName}</Text>
                <Text style={styles.trialWhen}>
                  {new Date(upcomingTrial.scheduledAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' · '}
                  {new Date(upcomingTrial.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </View>
          </TouchableOpacity>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Active café order strip (relocated from the old tab bar) */}
      <View style={styles.orderBarWrap} pointerEvents="box-none">
        <ActiveOrderBar navigation={navigation} />
      </View>

      {/* ── STICKY CHECK-IN FAB ──────────────────── */}
      <View style={styles.fabWrap} pointerEvents="box-none">
        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('Access')}>
          <LinearGradient
            colors={[COLORS.primary, '#923a93']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fab}
          >
            <MaterialIcons name="qr-code-scanner" size={30} color={COLORS.white} />
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.fabLabel}>CHECK IN</Text>
      </View>
    </View>
  );
}

function KpiCard({ label, value, icon, color }) {
  return (
    <View style={[styles.kpiCard, { borderTopColor: color + '4D' }]}>
      <View style={styles.kpiHeader}>
        <Text style={styles.eyebrow}>{label}</Text>
        <MaterialIcons name={icon} size={15} color={color} />
      </View>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
    </View>
  );
}

/**
 * MY COACH entry — avatar, coach name, last message and unread pill.
 * Renders nothing until the thread list is known, so Home never flashes a
 * "no coach" row for a member who does have one.
 */
function MyCoachCard({ navigation }) {
  const threads = useChatStore((s) => s.threads);
  const init = useChatStore((s) => s.init);

  useEffect(() => { init().catch(() => {}); }, [init]);

  const active = threads.find((t) => t.state !== 'archived');
  const hasPast = threads.some((t) => t.state === 'archived');
  if (!active && !hasPast) return null;

  const go = () => navigation.push('MyChat');

  if (!active) {
    return (
      <TouchableOpacity style={styles.coachCard} activeOpacity={0.85} onPress={go}>
        <View style={[styles.coachAvatar, styles.coachAvatarFallback]}>
          <MaterialIcons name="chat" size={22} color="#A78BFA" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.coachName}>Past coaches</Text>
          <Text style={styles.coachPreview} numberOfLines={1}>View your previous coaching chats</Text>
        </View>
        <MaterialIcons name="chevron-right" size={18} color={COLORS.textMuted} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.coachCard} activeOpacity={0.85} onPress={go}>
      {active.counterpartPhoto
        ? <Image source={{ uri: active.counterpartPhoto }} style={styles.coachAvatar} />
        : <View style={[styles.coachAvatar, styles.coachAvatarFallback]}>
            <Text style={styles.coachLetter}>{(active.counterpartName || 'C').charAt(0).toUpperCase()}</Text>
          </View>}
      <View style={{ flex: 1 }}>
        <Text style={styles.coachLabel}>MY COACH</Text>
        <Text style={styles.coachName} numberOfLines={1}>{active.counterpartName || 'Your Coach'}</Text>
        <Text style={styles.coachPreview} numberOfLines={1}>
          {active.lastMessagePreview || 'Say hi to your coach'}
        </Text>
      </View>
      {active.unread > 0
        ? <View style={styles.coachPill}><Text style={styles.coachPillTxt}>{active.unread}</Text></View>
        : <MaterialIcons name="chevron-right" size={18} color={COLORS.textMuted} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },

  // Top app bar
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  greeting: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textSecondary, letterSpacing: 2 },
  userName: { fontFamily: FONTS.headline, fontSize: 24, color: COLORS.white, marginTop: 2 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  topBtn: { padding: 2 },
  notifBadge: {
    position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.primaryNeon, borderWidth: 1.5, borderColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  notifBadgeText: { fontFamily: FONTS.bodyBold, fontSize: 9, color: '#fff' },
  avatarBtn: {},
  avatarImg: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: COLORS.primaryBorder },
  avatarFallback: { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FONTS.headline, fontSize: 18, color: COLORS.white },

  eyebrow: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textMuted, letterSpacing: 1.5 },

  // Announcement banner
  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: AMBER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 10 },
  bannerText: { fontFamily: FONTS.bodyBold, fontSize: 12, color: '#000', flex: 1 },

  // Weekly overview
  permissionBanner: { marginBottom: 16 },
  weekCard: {
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 18, borderWidth: 1, borderColor: COLORS.primaryBorder,
    padding: 16, marginBottom: 16, gap: 14,
  },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekMonth: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.white, marginTop: 2 },
  streakChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: COLORS.primaryBorder,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  streakChipText: { fontFamily: FONTS.bodyBold, fontSize: 10, color: COLORS.primaryLight },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekDay: { alignItems: 'center', gap: 8 },
  weekDow: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textMuted },
  weekToday: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: AMBER, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 4,
  },
  weekAttended: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: AMBER,
    alignItems: 'center', justifyContent: 'center',
  },
  weekAttendedNum: { fontFamily: FONTS.bodyBold, fontSize: 11, color: '#000' },
  weekFuture: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  weekFutureNum: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted },

  // KPI grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  kpiCard: {
    width: '47%', flexGrow: 1, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.border, borderTopWidth: 2, padding: 16, gap: 10,
  },
  kpiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kpiValue: { fontFamily: FONTS.headline, fontSize: 22 },

  // Calories
  calCard: {
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 18, borderWidth: 1, borderColor: COLORS.primaryBorder,
    padding: 18, marginBottom: 16, gap: 16,
  },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  calValue: { fontFamily: FONTS.headline, fontSize: 22, color: COLORS.white, marginTop: 2 },
  calUnit: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted },
  calDelta: { fontFamily: FONTS.label, fontSize: 10, color: GREEN },
  calGraphWrap: { position: 'relative', borderRadius: 10, overflow: 'hidden' },
  comingSoonWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  comingSoonBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: 'rgba(20,18,26,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  comingSoonText: { fontFamily: FONTS.label, fontSize: 11, letterSpacing: 1.6, color: COLORS.white },
  calChart: { height: 120, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  calBarSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  calBar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  calLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  calLabel: { fontFamily: FONTS.label, fontSize: 8, color: COLORS.textMuted, flex: 1, textAlign: 'center' },

  // Build Coins
  coinsCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1C1917', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)',
    padding: 18, marginBottom: 16,
  },
  coinsLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  coinsIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  coinsLabel: { fontFamily: FONTS.label, fontSize: 10, color: 'rgba(255,215,0,0.6)', letterSpacing: 1.5 },
  coinsValue: { fontFamily: FONTS.headline, fontSize: 28, color: COLORS.white, marginTop: 2 },
  coinsRight: { alignItems: 'flex-end', gap: 2 },
  coinsHint: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.textMuted, opacity: 0.5 },

  // Quick access
  coachCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.surface, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  coachAvatar: { width: 48, height: 48, borderRadius: 24 },
  coachAvatarFallback: { backgroundColor: COLORS.surface3, alignItems: 'center', justifyContent: 'center' },
  coachLetter: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  coachLabel: { fontFamily: FONTS.label, fontSize: 10, color: '#A78BFA', letterSpacing: 2 },
  coachName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 1 },
  coachPreview: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  coachPill: { backgroundColor: COLORS.primary, borderRadius: 11, minWidth: 22, paddingHorizontal: 7, paddingVertical: 3, alignItems: 'center' },
  coachPillTxt: { color: COLORS.black, fontSize: 11, fontWeight: '800' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  // Stitch: glass-card · p-4 · rounded-2xl · gap-2 · items/justify-center.
  // Real vertical padding (no aspectRatio) keeps the label balanced off the
  // bottom edge on every screen size.
  // Grid slot: fixes each tile's footprint so greyed (GreyedOut-wrapped) and
  // normal tiles occupy identical space — 3 per row, wrapping to new rows.
  quickTileSlot: { width: '30%', flexGrow: 1 },
  quickTileDisabled: { opacity: 0.4 },
  quickSoonWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  quickSoonBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(20,18,26,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  quickSoonText: { fontFamily: FONTS.label, fontSize: 8, letterSpacing: 0.8, color: COLORS.white },
  quickTile: {
    width: '100%', backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 18, paddingHorizontal: 8,
  },
  quickIcon: {
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
  },
  quickLabel: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textSecondary, letterSpacing: 1 },

  // Today's workout
  workoutCard: {
    backgroundColor: '#1E1E2E', borderRadius: 18, borderLeftWidth: 2, borderLeftColor: '#00BCD4',
    padding: 18, gap: 14,
  },
  workoutEyebrow: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textMuted, letterSpacing: 2 },
  workoutCoach: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textMuted, opacity: 0.6, marginTop: 4 },
  workoutTitle: { fontFamily: FONTS.headline, fontSize: 22, color: COLORS.white },
  workoutMeta: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  workoutFooter: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 12, gap: 10 },
  workoutExercises: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textMuted, opacity: 0.6, letterSpacing: 0.5 },
  workoutLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  workoutLinkText: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.primaryLight, letterSpacing: 1 },

  // Upcoming trial card
  trialCard: {
    backgroundColor: '#16242A', borderRadius: 18, borderLeftWidth: 2, borderLeftColor: CYAN,
    padding: 16, gap: 12, marginTop: 16,
  },
  trialTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trialBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,206,209,0.12)', borderWidth: 1, borderColor: 'rgba(0,206,209,0.4)',
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
  },
  trialBadgeText: { fontFamily: FONTS.label, fontSize: 9, color: CYAN, letterSpacing: 1 },
  trialCountdown: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textMuted },
  trialBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trialPhoto: { width: 44, height: 44, borderRadius: 22 },
  trialPhotoFallback: { backgroundColor: 'rgba(0,206,209,0.15)', alignItems: 'center', justifyContent: 'center' },
  trialInitials: { fontFamily: FONTS.bodyBold, fontSize: 15, color: CYAN },
  trialCoach: { fontFamily: FONTS.headline, fontSize: 16, color: COLORS.white },
  trialWhen: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  // Active order bar (sits above the FAB)
  orderBarWrap: { position: 'absolute', left: 0, right: 0, bottom: 96 },

  // Sticky Check-In FAB
  fabWrap: { position: 'absolute', bottom: 24, left: 0, right: 0, alignItems: 'center', gap: 8 },
  fab: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,159,251,0.5)',
  },
  fabLabel: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.white, opacity: 0.6, letterSpacing: 2 },
});
