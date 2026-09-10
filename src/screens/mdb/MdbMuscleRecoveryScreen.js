/**
 * Screen 20 — Muscle Recovery Detail.
 * Port of `screen_20_muscle_recovery_detail.html`.
 *
 * Ten cards in the PRD A.7 order — Chest, Back, Shoulders, Biceps, Triceps,
 * Quads, Hamstrings, Glutes, Core, Calves — each carrying the muscle name, its
 * status word, a 4px score bar, and the two facts behind the score: when it was
 * last trained and its 72-hour volume.
 *
 * Copy restraint is the point of this screen: labels only ("Fresh", "Moderate",
 * "Worked"), never advice. Nothing here tells the member what to train.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MC, MF, MR, MS, RECOVERY, recoveryStatus } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import { EmptyState } from '../../components/mdb/MdbPrimitives';
import { fetchMuscleRecovery } from '../../services/workoutService';
import { titleCase } from '../../utils/mdbWorkout';

// PRD A.7 display order — deliberately anatomical, not alphabetical and not
// sorted by score, so a member finds the same muscle in the same place daily.
const ORDER = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'core', 'calves',
];

export default function MdbMuscleRecoveryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await fetchMuscleRecovery() || []); }
    catch { setRows([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ordered = useMemo(() => {
    const byName = new Map(rows.map((r) => [r.muscleGroup, r]));
    const known = ORDER.map((m) => byName.get(m)).filter(Boolean);
    // Anything the backend adds later that isn't in ORDER still shows, at the end.
    const extra = rows.filter((r) => !ORDER.includes(r.muscleGroup));
    return [...known, ...extra];
  }, [rows]);

  const updatedAt = rows[0]?.computedAt ? updatedLabel(rows[0].computedAt) : null;

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      <View style={[s.topBar, { marginTop: insets.top }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MdbIcon name="chevron-left" size={20} color={MC.textSecondary} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Recovery</Text>
        <View style={s.backBtn} />
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
          {ordered.length === 0 ? (
            <EmptyState
              title="No recovery data yet"
              subtitle="Log a workout and your muscle readiness appears here."
            />
          ) : (
            <>
              <View style={s.metaRow}>
                <Text style={s.metaText}>{updatedAt || 'Updated recently'}</Text>
                <Text style={s.metaCount}>{ordered.length} Groups</Text>
              </View>

              {ordered.map((m) => (
                <MuscleCard key={m.muscleGroup} row={m} />
              ))}
            </>
          )}
          <View style={{ height: 48 }} />
        </ScrollView>
      )}
    </View>
  );
}

function MuscleCard({ row }) {
  const key = row.status || recoveryStatus(row.score);
  const meta = RECOVERY[key] || RECOVERY.fresh;
  const score = Math.round(row.score);

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.muscle}>{titleCase(row.muscleGroup)}</Text>
        <View style={s.statusWrap}>
          <View style={[s.statusDot, { backgroundColor: meta.color }]} />
          <Text style={[s.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      <View style={s.barRow}>
        <View style={s.track}>
          <View style={[s.fill, { width: `${Math.max(0, Math.min(100, score))}%`, backgroundColor: meta.color }]} />
        </View>
        <Text style={s.scoreText}>{score}</Text>
      </View>

      <View style={s.footRow}>
        <Text style={s.footText}>{lastTrainedLabel(row.lastTrainedAt)}</Text>
        <Text style={s.footText}>
          {row.volume72h != null
            ? `${Math.round(row.volume72h).toLocaleString()} kg in last 72h`
            : ''}
        </Text>
      </View>
    </View>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** "Last trained 18h ago" · "yesterday" · "3 days ago" · "Not trained yet". */
function lastTrainedLabel(value) {
  if (!value) return 'Not trained yet';
  const then = new Date(value).getTime();
  if (isNaN(then)) return 'Not trained yet';
  const hours = (Date.now() - then) / 3600000;
  if (hours < 1) return 'Last trained just now';
  if (hours < 24) return `Last trained ${Math.round(hours)}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Last trained yesterday';
  return `Last trained ${days} days ago`;
}

function updatedLabel(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return sameDay
    ? `Updated today at ${time}`
    : `Updated ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at ${time}`;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MC.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: MS.hMargin,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: MF.semibold, fontSize: 16, color: MC.text },

  scroll: { paddingHorizontal: MS.hMargin, paddingTop: 12, gap: 10 },

  metaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, marginBottom: 2,
  },
  metaText: { fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary },
  metaCount: {
    fontFamily: MF.mono, fontSize: 10, color: MC.textTertiary,
    fontVariant: ['tabular-nums'],
  },

  card: {
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder,
    borderRadius: MR.card, padding: 14, gap: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muscle: { fontFamily: MF.semibold, fontSize: 14, color: MC.text },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: MF.semibold, fontSize: 11 },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  scoreText: {
    fontFamily: MF.mono, fontSize: 10, color: MC.textTertiary,
    fontVariant: ['tabular-nums'], minWidth: 20, textAlign: 'right',
  },

  footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footText: { fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary },
});
