/**
 * Share Session Card — the host screen for screens 12 / 13 / 14.
 *
 * Live preview with a Feed (4:5) / Story (9:16) switch, then capture and hand
 * off to the OS share sheet. Rendering happens entirely on device via
 * react-native-view-shot — no server round trip, so nothing about the session
 * leaves the phone unless the member actually shares it.
 *
 * ⚠️ react-native-view-shot and expo-sharing are native modules: this screen
 * needs a fresh dev-client / EAS build, it will not work over OTA.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Alert, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import { MC, MG, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import { EmptyState } from '../../components/mdb/MdbPrimitives';
import MdbShareCard, { FEED_RATIO, STORY_RATIO, OUTPUT_WIDTH } from '../../components/mdb/MdbShareCard';
import { fetchInstances, fetchWorkoutDetail } from '../../services/workoutService';
import { isoDate } from '../../utils/mdbWorkout';
import { useAuthStore } from '../../store/authStore';

const FORMATS = [
  { key: 'feed', label: 'Feed', dims: '1080 × 1350' },
  { key: 'story', label: 'Story', dims: '1080 × 1920' },
];

export default function MdbShareCardScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);
  const { date } = route.params || {};

  const cardRef = useRef(null);
  const [format, setFormat] = useState('feed');
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  // A "session" is every workout completed that day, not just the one just
  // finished — a freestyle member can now schedule several for one day.
  useEffect(() => {
    (async () => {
      try {
        const targetDate = date || isoDate(new Date());
        const inst = await fetchInstances();
        const seen = new Set();
        const rows = [...(inst?.today || []), ...(inst?.history || [])].filter((r) => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return String(r.workoutDate).slice(0, 10) === targetDate
            && (r.status === 'completed' || r.status === 'partial');
        });
        setDetails(await Promise.all(rows.map((r) => fetchWorkoutDetail(r.id))));
      } catch {
        setDetails([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [date]);

  const data = useMemo(() => buildCardData(details || [], user), [details, user]);

  // Story is much taller, so it previews narrower to stay on one screen.
  const cardWidth = Math.min(screenW - 32, format === 'story' ? 260 : 340);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'This device has no share targets configured.');
        return;
      }
      const ratio = format === 'story' ? STORY_RATIO : FEED_RATIO;
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        // Capture at full social resolution regardless of the preview size.
        width: OUTPUT_WIDTH,
        height: Math.round(OUTPUT_WIDTH * ratio),
      });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share session card',
        UTI: 'public.png',
      });
    } catch (e) {
      Alert.alert('Could not create card', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

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
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MdbIcon name="chevron-left" size={20} color={MC.textSecondary} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Session Card</Text>
        <View style={s.iconBtn} />
      </View>

      {!details?.length ? (
        <EmptyState title="Nothing completed that day yet" subtitle="Finish a workout to share a session card." style={s.emptyState} />
      ) : (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* ── Format switch ────────────────────────────────────────────────── */}
        <View style={s.formatRow}>
          {FORMATS.map((f) => {
            const on = f.key === format;
            return (
              <TouchableOpacity
                key={f.key}
                style={[s.formatBtn, on && s.formatBtnOn]}
                onPress={() => setFormat(f.key)}
                activeOpacity={0.85}
              >
                <Text style={[s.formatLabel, on && s.formatLabelOn]}>{f.label}</Text>
                <Text style={s.formatDims}>{f.dims}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Live preview (this exact view is what gets captured) ─────────── */}
        <View style={s.previewWrap}>
          <MdbShareCard cardRef={cardRef} data={data} format={format} width={cardWidth} />
        </View>

        <Text style={s.privacyNote}>
          Cards never include body weight, recovery scores, nutrition or photos.
        </Text>

        <TouchableOpacity onPress={share} activeOpacity={0.9} disabled={busy}>
          <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.shareBtn}>
            {busy
              ? <ActivityIndicator color={MC.white} />
              : <Text style={s.shareText}>SHARE CARD</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: MS.bottomRoom }} />
      </ScrollView>
      )}
    </View>
  );
}

/**
 * Map the day's completed workout(s) onto the card's fields. `details` is
 * every workout_logs row completed that day — usually one, but a freestyle
 * member can now schedule several, and the card is meant to represent the
 * whole session, not just whichever one happened to be opened last.
 */
function buildCardData(details, user) {
  const allSets = details.flatMap((d) => d.sets || []);
  const allExercises = details.flatMap((d) => d.snapshot?.exercises || []);
  const nameOf = (id) => allExercises.find((e) => e.exerciseId === id)?.name || 'Exercise';

  // One line per exercise that set a record, heaviest first, capped at two —
  // the card has room for two and the pack shows no more.
  const byExercise = new Map();
  for (const st of allSets.filter((x) => x.isPr)) {
    const w = Number(st.actualWeight) || 0;
    if (!byExercise.has(st.exerciseId) || w > byExercise.get(st.exerciseId).w) {
      byExercise.set(st.exerciseId, { w, label: `${nameOf(st.exerciseId)}, ${trim(st.actualWeight)} kg` });
    }
  }
  const prs = [...byExercise.values()].sort((a, b) => b.w - a.w).slice(0, 2).map((p) => p.label);

  const memberName = user?.fullName
    ? `${user.fullName.split(' ')[0]} ${(user.fullName.split(' ').slice(-1)[0] || '').charAt(0)}.`.trim()
    : (user?.firstName || 'Member');

  const names = details.map((d) => d.snapshot?.name || d.sourceTemplateName).filter(Boolean);
  const title = details.length === 0 ? 'Workout' : names.length <= 2 ? names.join(' + ') : `${details.length} Workouts`;

  return {
    title,
    date: details[0]?.workoutDate,
    durationMinutes: details.reduce((n, d) => n + (Number(d.durationMinutes) || 0), 0),
    volumeKg: Math.round(details.reduce((n, d) => n + (Number(d.totalVolume) || 0), 0)),
    setsDone: allSets.length,
    setsTotal: allExercises.reduce((n, e) => n + (Number(e.sets) || 0), 0),
    exerciseCount: new Set(allExercises.map((e) => e.exerciseId)).size
      || new Set(allSets.map((x) => x.exerciseId)).size,
    prs,
    memberName,
  };
}

const trim = (n) => (Number.isInteger(Number(n)) ? String(Number(n)) : String(n));

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MC.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, justifyContent: 'center' },
  topBar: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: MS.hMargin,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: MF.semibold, fontSize: 16, color: MC.text },

  scroll: { paddingHorizontal: MS.hMargin, paddingTop: 16, gap: 16, alignItems: 'center' },

  formatRow: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  formatBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: MR.card,
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder,
  },
  formatBtnOn: { borderColor: MC.violet, backgroundColor: 'rgba(120,61,236,0.15)' },
  formatLabel: { fontFamily: MF.semibold, fontSize: 13, color: MC.textSecondary },
  formatLabelOn: { color: MC.text },
  formatDims: {
    fontFamily: MF.mono, fontSize: 9, color: MC.textTertiary, marginTop: 2,
    fontVariant: ['tabular-nums'],
  },

  previewWrap: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden',
    shadowColor: MC.violet, shadowOpacity: 0.3, shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 }, elevation: 10,
  },
  privacyNote: {
    textAlign: 'center', fontFamily: MF.regular, fontSize: 10,
    color: MC.textTertiary, paddingHorizontal: 16,
  },
  shareBtn: {
    height: 46, width: 260, borderRadius: MR.button,
    alignItems: 'center', justifyContent: 'center',
  },
  shareText: {
    fontFamily: MF.semibold, fontSize: 13, letterSpacing: 1.4,
    textTransform: 'uppercase', color: MC.white,
  },
});
