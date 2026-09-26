/**
 * Screen 22 — Workout History (multi-source chronological feed).
 * Port of `screen_22_workout_history.html`.
 *
 * Sessions grouped by day, newest first, each day headed by a dot (violet for
 * today, white/20 otherwise) and its long-form date. App workouts are the
 * primary citizens: full stat line, amber PR dot. Wearable imports would render
 * as the secondary form, with the "does not count for streaks or leaderboard"
 * notice (PRD C.3 / C.5).
 *
 * Apple Watch workouts (Part C) come from /wearables/workouts on iOS and are
 * merged in per day, after the app's own sessions. They have no detail screen
 * (there are no sets to show), so their rows are not tappable. Whoop stays
 * listed-but-inert until its phase.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl, Modal, Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MC, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import { LuxuryCard, EmptyState } from '../../components/mdb/MdbPrimitives';
import { fetchWorkoutHistory } from '../../services/workoutService';
import { fetchWearableWorkouts } from '../../services/wearableService';
import { isoDate } from '../../utils/mdbWorkout';

const IS_IOS = Platform.OS === 'ios';

const SOURCES = [
  { key: 'all', label: 'All' },
  { key: 'app', label: 'App Only' },
  // Apple Health is iPhone-only; Whoop stays inert until its phase.
  { key: 'apple', label: 'Apple Watch', disabled: !IS_IOS },
  { key: 'whoop', label: 'Whoop', disabled: true },
];

export default function MdbWorkoutHistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState([]);
  const [source, setSource] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // Device workouts are a bonus: if that request fails the app history must
    // still show, so the two are settled independently.
    const [appRes, deviceRes] = await Promise.allSettled([
      fetchWorkoutHistory({ limit: 50 }),
      IS_IOS ? fetchWearableWorkouts({ limit: 50 }) : Promise.resolve([]),
    ]);
    const appRows = appRes.status === 'fulfilled'
      ? (Array.isArray(appRes.value) ? appRes.value : (appRes.value?.items || appRes.value?.data || []))
      : [];
    const deviceRows = deviceRes.status === 'fulfilled' && Array.isArray(deviceRes.value) ? deviceRes.value : [];
    setRows([...appRows, ...deviceRows]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => groupByDay(rows, source), [rows, source]);

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      <View style={[s.topBar, { marginTop: insets.top }]}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MdbIcon name="chevron-left" size={20} color={MC.textSecondary} />
        </TouchableOpacity>
        <Text style={s.topTitle}>History</Text>
        <TouchableOpacity style={s.iconBtn} onPress={() => setFilterOpen(true)} activeOpacity={0.7} hitSlop={8}>
          <MdbIcon name="sliders" size={16} color={MC.textTertiary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={MC.violetLight} /></View>
      ) : (
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
          {groups.length === 0 ? (
            <EmptyState
              title="No sessions logged yet"
              subtitle="Completed workouts appear here."
            />
          ) : (
            groups.map((g) => (
              <View key={g.date} style={s.group}>
                <View style={s.groupHead}>
                  <View style={[s.groupDot, g.isToday && s.groupDotToday]} />
                  <Text style={s.groupTitle}>{g.label}</Text>
                </View>

                {g.items.map((row) => {
                  const external = row.source && row.source !== 'app';
                  return (
                    <SessionCard
                      key={`${row.source || 'app'}-${row.id}`}
                      row={row}
                      onPress={external ? undefined : () => navigation.navigate('MdbWorkoutSummary', { workoutLogId: row.id })}
                    />
                  );
                })}
              </View>
            ))
          )}
          <View style={{ height: MS.bottomRoom }} />
        </ScrollView>
      )}

      {/* ── Filter sheet ─────────────────────────────────────────────────── */}
      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setFilterOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.grab} />
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>Filter History</Text>
              <TouchableOpacity onPress={() => setFilterOpen(false)} activeOpacity={0.7}>
                <Text style={s.sheetClose}>Close</Text>
              </TouchableOpacity>
            </View>

            <View>
              <Text style={s.sheetLabel}>Source</Text>
              <View style={s.sourceRow}>
                {SOURCES.map((opt) => {
                  const on = opt.key === source;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[s.sourceChip, on && s.sourceChipOn, opt.disabled && s.sourceChipOff]}
                      onPress={() => !opt.disabled && setSource(opt.key)}
                      activeOpacity={opt.disabled ? 1 : 0.8}
                    >
                      <Text style={[s.sourceText, on && s.sourceTextOn]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity style={s.applyBtn} onPress={() => setFilterOpen(false)} activeOpacity={0.85}>
              <Text style={s.applyText}>Apply Filter</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ── One session row ─────────────────────────────────────────────────────── */
function SessionCard({ row, onPress }) {
  const external = row.source && row.source !== 'app';
  // The list endpoint doesn't (and shouldn't) re-derive this — the snapshot
  // already carries the planned exercise list on every row.
  const exerciseCount = row.exerciseCount || row.snapshot?.exercises?.length || 0;
  const stats = external
    ? [
        row.durationMinutes ? `${row.durationMinutes} min` : null,
        row.calories != null ? `${Math.round(row.calories)} kcal` : null,
        row.avgHeartRate ? `${row.avgHeartRate} bpm avg` : null,
      ]
    : [
        row.durationMinutes ? `${row.durationMinutes} min` : null,
        row.totalVolume ? `${Math.round(Number(row.totalVolume)).toLocaleString()} kg` : null,
        row.setCount ? `${row.setCount} sets` : null,
        exerciseCount ? `${exerciseCount} exercises` : null,
        row.finalCalorieValue != null ? `${Math.round(Number(row.finalCalorieValue))} kcal` : null,
      ];

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} disabled={!onPress}>
      <LuxuryCard style={external ? s.cardSecondary : s.cardPrimary}>
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}>
            <View style={s.cardTitleRow}>
              <Text style={external ? s.titleSecondary : s.titlePrimary} numberOfLines={1}>
                {row.snapshot?.name || row.sourceTemplateName || row.name || 'Workout'}
              </Text>
              <View style={external ? s.badgeCyan : s.badgeNeutral}>
                <Text style={external ? s.badgeCyanText : s.badgeNeutralText}>
                  {external ? sourceLabel(row.source) : 'App'}
                </Text>
              </View>
            </View>
            <Text style={external ? s.statsSecondary : s.statsPrimary}>
              {stats.filter(Boolean).join(' · ')}
            </Text>
          </View>

          {row.hasPr ? (
            <View style={s.prDot} />
          ) : onPress ? (
            <MdbIcon name="chevron-right" size={14} color={MC.textTertiary} />
          ) : null}
        </View>

        {external && (
          <Text style={s.externalNote}>
            External workout — does not count for studio streaks or leaderboard
          </Text>
        )}
      </LuxuryCard>
    </TouchableOpacity>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function groupByDay(rows, source) {
  const filtered = rows.filter((r) => {
    if (source === 'all') return true;
    if (source === 'app') return !r.source || r.source === 'app';
    return r.source === source;
  });

  const byDate = new Map();
  for (const r of filtered) {
    const key = String(r.workoutDate || r.date || '').slice(0, 10);
    if (!key) continue;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(r);
  }

  const today = isoDate(new Date());
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({
      date,
      items: [
        ...items.filter((r) => !r.source || r.source === 'app'),
        ...items
          .filter((r) => r.source && r.source !== 'app')
          .sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || ''))),
      ],
      isToday: date === today,
      label: dayLabel(date),
    }));
}

function dayLabel(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

const sourceLabel = (src) =>
  src === 'apple' ? 'Apple Watch' : src === 'whoop' ? 'Whoop' : 'External';

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MC.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: MS.hMargin,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: MF.semibold, fontSize: 16, color: MC.text },

  scroll: { paddingHorizontal: MS.hMargin, paddingTop: 16, gap: 16 },

  group: { gap: 8 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  groupDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.20)' },
  groupDotToday: { backgroundColor: MC.violet },
  groupTitle: {
    fontFamily: MF.semibold, fontSize: 11, letterSpacing: 1,
    textTransform: 'uppercase', color: MC.textSecondary,
  },

  cardPrimary: { padding: 16, gap: 8 },
  cardSecondary: { padding: 14, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  titlePrimary: { fontFamily: MF.semibold, fontSize: 14, color: MC.text },
  titleSecondary: { fontFamily: MF.medium, fontSize: 13, color: MC.text },
  statsPrimary: {
    fontFamily: MF.mono, fontSize: 12, color: MC.textSecondary,
    fontVariant: ['tabular-nums'], marginTop: 2,
  },
  statsSecondary: {
    fontFamily: MF.mono, fontSize: 11, color: MC.textSecondary,
    fontVariant: ['tabular-nums'], marginTop: 2,
  },

  badgeNeutral: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: MR.xs,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  badgeNeutralText: {
    fontFamily: MF.semibold, fontSize: 9, letterSpacing: 0.6,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  badgeCyan: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: MR.xs,
    backgroundColor: 'rgba(6,180,213,0.10)',
    borderWidth: 1, borderColor: 'rgba(6,180,213,0.30)',
  },
  badgeCyanText: { fontFamily: MF.semibold, fontSize: 9, color: MC.cyan },

  prDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: MC.warm, marginTop: 4 },
  externalNote: { fontFamily: MF.regular, fontSize: 9, color: MC.textTertiary },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.80)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#100D18',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 32, gap: 16,
  },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.20)', alignSelf: 'center' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: MF.semibold, fontSize: 14, color: MC.text },
  sheetClose: { fontFamily: MF.regular, fontSize: 12, color: MC.textTertiary },
  sheetLabel: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1,
    textTransform: 'uppercase', color: MC.textTertiary, marginBottom: 6,
  },
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sourceChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: MR.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sourceChipOn: {
    backgroundColor: 'rgba(120,61,236,0.20)',
    borderWidth: 1, borderColor: 'rgba(120,61,236,0.40)',
  },
  sourceChipOff: { opacity: 0.4 },
  sourceText: { fontFamily: MF.regular, fontSize: 12, color: MC.textTertiary },
  sourceTextOn: { fontFamily: MF.medium, color: MC.white },

  applyBtn: {
    height: 40, borderRadius: MR.button,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  applyText: {
    fontFamily: MF.semibold, fontSize: 12, letterSpacing: 0.8,
    textTransform: 'uppercase', color: MC.white,
  },
});
