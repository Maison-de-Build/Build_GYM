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
import { BackPill, BrandFooter } from '../../components/mdb/MdbPrimitives';
import WorkoutDayCard from '../../components/mdb/WorkoutDayCard';
import WorkoutEmptyState from '../../components/mdb/WorkoutEmptyState';
import MdbSecondaryNav from '../../components/mdb/MdbSecondaryNav';
import { fetchInstances, fetchInstancesRange, fetchMuscleRecovery, browseTemplates } from '../../services/workoutService';
import {
  buildDayStrip, estimatedMinutes,
  groupInstancesByDate, flattenInstances, parseIsoLocal, dayPermissions, monthBounds, monthTitle,
  isoDate, relativeDateTime, titleCase,
} from '../../utils/mdbWorkout';

export default function MdbFreestyleCalendarScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [instances, setInstances] = useState({ today: [], upcoming: [], history: [] });
  const [recovery, setRecovery] = useState([]);
  const [suggested, setSuggested] = useState([]);
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
  const workouts = selectedDay?.instances || [];

  const openBrowser = () => {
    if (!perms.canSchedule) return;
    navigation.navigate('MdbTemplateBrowser', { date: selectedDay?.iso });
  };

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

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
          {/* ── Scheduled workout(s), or the inviting empty state ────────── */}
          {/* View/schedule only — logging itself lives on Home now. */}
          {workouts.length > 0 ? (
            <View style={{ gap: 12 }}>
              {workouts.map((w) => (
                <WorkoutDayCard
                  key={w.id}
                  workout={w}
                  readOnly
                  readOnlyReason={selectedDay?.isToday ? null : perms.reason}
                  onViewCompleted={() => navigation.navigate('MdbWorkoutSummary', { workoutLogId: w.id })}
                />
              ))}
              {perms.canSchedule && (
                <TouchableOpacity style={s.addMoreRow} onPress={openBrowser} activeOpacity={0.7}>
                  <MdbIcon name="plus" size={14} color={MC.violetLight} />
                  <Text style={s.addMoreText}>Add another workout</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <WorkoutEmptyState variant="freestyle" canAdd={perms.canSchedule} onAdd={openBrowser} />
          )}

          {/* ── SUGGESTED FOR YOU ──────────────────────────────────────── */}
          {/* Hidden on a past day for the same reason the "+" is: every card
              here leads to scheduling, and self-assign only accepts today..+14,
              so on a past date the whole rail is a dead end ending in a 400. */}
          {suggested.length > 0 && perms.canSchedule && (
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
                    onPress={() => navigation.navigate('MdbTemplateBrowser', {
                      date: selectedDay?.iso, preselectTemplateId: t.id,
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

  addMoreRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, borderRadius: MR.button,
    borderWidth: 1, borderColor: 'rgba(120,61,236,0.35)', borderStyle: 'dashed',
  },
  addMoreText: { fontFamily: MF.medium, fontSize: 12, color: MC.violetLight },

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
});
