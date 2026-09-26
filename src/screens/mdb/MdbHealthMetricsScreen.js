/**
 * Screen 21 — Health Metrics Detail.
 *
 * One page, top to bottom: today's calories first (this is where Home's
 * CALORIES BURNED card lands), then the member's Apple Health metrics.
 *
 * Calories come from /member/dashboard. With Apple Health connected, the
 * backend counts each day once — the higher of the Watch's active calories and
 * the app's logged sessions — so the Watch and a logged gym session are never
 * added together.
 *
 * Wearable metrics come from /wearables/metrics (synced from Apple Health):
 * resting heart rate, HRV, sleep and daily heart rate. All real — there is no
 * demo data on this page any more. Nothing renders for the wearable block on
 * Android (Apple Health is iPhone-only; Whoop arrives in its own phase).
 *
 * HRV note, kept from the pack: Apple reports SDNN and Whoop reports RMSSD.
 * They are different statistics and are never mixed — the label always names
 * the one on screen.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { MC, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import MdbLineChart from '../../components/mdb/MdbLineChart';
import { LuxuryCard } from '../../components/mdb/MdbPrimitives';
import { fetchDashboard } from '../../services/dashboardService';
import { fetchWearableMetrics } from '../../services/wearableService';
import { localDateKey } from '../../services/wearables/healthMapping';

const IS_IOS = Platform.OS === 'ios';

const RANGES = ['1W', '1M', '3M', '6M'];
const RANGE_TO_PERIOD = { '1W': 'week', '1M': 'month', '3M': 'all', '6M': 'all' };
const RANGE_DAYS = { '1W': 7, '1M': 30, '3M': 90, '6M': 180 };

const fmtHm = (mins) => {
  if (mins == null) return '—';
  const m = Math.round(mins);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};

function dayLabel(iso) {
  const today = localDateKey(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (iso === today) return 'Today';
  if (iso === localDateKey(y)) return 'Yesterday';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Series + the most recent reading for one metric. */
function seriesOf(days, key) {
  const pts = days.filter((d) => d[key] != null).map((d) => ({ date: d.date, y: d[key] }));
  return { points: pts, latest: pts.length ? pts[pts.length - 1] : null };
}

function buildSections(days) {
  const resting = seriesOf(days, 'restingHeartRate');
  const hrv = seriesOf(days, 'hrvMs');
  const sleep = seriesOf(days, 'sleepMinutes');
  const hr = seriesOf(days, 'avgHeartRate');

  const latestSleepDay = sleep.latest ? days.find((d) => d.date === sleep.latest.date) : null;
  const st = latestSleepDay?.sleepStages || {};
  const stageParts = [
    st.deep != null && `Deep ${fmtHm(st.deep)}`,
    st.rem != null && `REM ${fmtHm(st.rem)}`,
    st.core != null && `Core ${fmtHm(st.core)}`,
  ].filter(Boolean);

  const latestHrDay = hr.latest ? days.find((d) => d.date === hr.latest.date) : null;

  return [
    {
      key: 'resting',
      title: 'Resting Heart Rate',
      hero: resting.latest ? `${Math.round(resting.latest.y)} bpm` : '—',
      caption: resting.latest
        ? `${dayLabel(resting.latest.date)} · average ${Math.round(avg(resting.points.map((p) => p.y)))} bpm this period`
        : 'No readings yet — your Watch records this through the day.',
      points: resting.points,
      unit: 'bpm',
    },
    {
      key: 'hrv',
      title: 'HRV (SDNN)',
      hero: hrv.latest ? `${Math.round(hrv.latest.y)} ms` : '—',
      caption: hrv.latest
        ? `${dayLabel(hrv.latest.date)} · SDNN from Apple Watch`
        : 'No readings yet — your Watch measures HRV mostly while you sleep.',
      points: hrv.points,
      unit: 'ms',
    },
    {
      key: 'sleep',
      title: 'Sleep',
      hero: sleep.latest ? fmtHm(sleep.latest.y) : '—',
      caption: sleep.latest
        ? `${dayLabel(sleep.latest.date)}${stageParts.length ? ` · ${stageParts.join(' · ')}` : ''}`
        : 'No sleep recorded yet — wear your Watch to bed.',
      points: sleep.points.map((p) => ({ ...p, y: Math.round((p.y / 60) * 10) / 10 })),
      unit: 'h',
    },
    {
      key: 'hr',
      title: 'Heart Rate',
      hero: hr.latest ? `${Math.round(hr.latest.y)} bpm` : '—',
      caption: latestHrDay
        ? `${dayLabel(latestHrDay.date)} average${latestHrDay.minHeartRate != null && latestHrDay.maxHeartRate != null
          ? ` · range ${Math.round(latestHrDay.minHeartRate)}–${Math.round(latestHrDay.maxHeartRate)} bpm` : ''}`
        : 'No heart-rate readings yet.',
      points: hr.points,
      unit: 'bpm',
    },
  ];
}

export default function MdbHealthMetricsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState('1M');

  const [calData, setCalData] = useState(null);
  const [calLoading, setCalLoading] = useState(true);

  const [metrics, setMetrics] = useState(null); // { connection, days }
  const [metricsLoading, setMetricsLoading] = useState(IS_IOS);
  const [metricsError, setMetricsError] = useState(false);

  const load = useCallback(() => {
    let alive = true;

    setCalLoading(true);
    fetchDashboard(RANGE_TO_PERIOD[range] || 'month')
      .then((d) => { if (alive) setCalData(d); })
      .catch(() => { if (alive) setCalData(null); })
      .finally(() => { if (alive) setCalLoading(false); });

    if (IS_IOS) {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - (RANGE_DAYS[range] - 1));
      setMetricsLoading(true);
      fetchWearableMetrics({ from: localDateKey(from), to: localDateKey(to), provider: 'apple' })
        .then((m) => { if (alive) { setMetrics(m); setMetricsError(false); } })
        .catch(() => { if (alive) setMetricsError(true); })
        .finally(() => { if (alive) setMetricsLoading(false); });
    }

    return () => { alive = false; };
  }, [range]);

  // Reload on focus too, so returning from Devices after connecting shows data.
  useFocusEffect(load);

  const cal = calData?.combinedCaloriesToday;
  const calToday = cal?.total;
  const logged = (cal?.workout ?? 0) + (cal?.activity ?? 0);
  const calBreakdown = !cal
    ? ''
    : cal.wearable != null
      ? `Apple Watch ${cal.wearable} kcal active · Logged sessions ${logged} kcal · counted once`
      : `Workout ${cal.workout ?? 0} kcal · Activity ${cal.activity ?? 0} kcal`;
  const calPeriodTotal = calData?.kpis?.calories;

  const connected = metrics?.connection?.status === 'connected';
  const days = metrics?.days || [];
  const sections = connected ? buildSections(days) : [];

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      <View style={[s.topBar, { marginTop: insets.top }]}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MdbIcon name="chevron-left" size={20} color={MC.textSecondary} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Health Metrics</Text>
        {IS_IOS ? (
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => navigation.navigate('MdbWearableSettings')}
            activeOpacity={0.7}
            hitSlop={8}
            accessibilityLabel="Devices"
          >
            <MdbIcon name="watch" size={18} color={MC.textSecondary} />
          </TouchableOpacity>
        ) : (
          <View style={s.iconBtn} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* ── Calories ─────────────────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>CALORIES</Text>

        <LuxuryCard style={s.heroCard}>
          <Text style={s.eyebrow}>TODAY</Text>
          <View style={s.heroRow}>
            <Text style={s.heroValue}>{calLoading ? '—' : (calToday ?? 0).toLocaleString()}</Text>
            <Text style={s.heroUnit}>kcal</Text>
          </View>
          <Text style={s.heroCaption}>{calLoading ? 'Loading…' : (calBreakdown || 'No sessions logged yet')}</Text>
        </LuxuryCard>

        <LuxuryCard style={s.chartCard}>
          <View style={s.chartHead}>
            <Text style={s.chartTitle}>This period</Text>
            <RangePicker range={range} onChange={setRange} />
          </View>
          <Text style={s.periodValue}>
            {calLoading ? '—' : `${(calPeriodTotal ?? 0).toLocaleString()} kcal`}
          </Text>
        </LuxuryCard>

        {/* ── Apple Health (iPhone only) ─────────────────────────────────── */}
        {IS_IOS && (
          <>
            <View style={s.wearableHead}>
              <Text style={s.sectionLabel}>WEARABLE</Text>
              <View style={s.deviceChip}>
                <Text style={s.deviceText}>Apple Health</Text>
              </View>
            </View>

            {metricsLoading && !metrics ? (
              <View style={s.loadingBox}><ActivityIndicator color={MC.violetLight} /></View>
            ) : metricsError ? (
              <LuxuryCard style={s.ctaCard}>
                <Text style={s.ctaText}>Couldn't load your health metrics. Go back and reopen this screen to try again.</Text>
              </LuxuryCard>
            ) : !connected ? (
              <LuxuryCard style={s.ctaCard}>
                <Text style={s.ctaTitle}>See your heart rate, HRV and sleep</Text>
                <Text style={s.ctaText}>
                  Connect Apple Health to bring in readings from your Apple Watch.
                </Text>
                <TouchableOpacity
                  style={s.ctaBtn}
                  onPress={() => navigation.navigate('MdbWearableSettings')}
                  activeOpacity={0.85}
                >
                  <Text style={s.ctaBtnText}>Connect Apple Health</Text>
                </TouchableOpacity>
              </LuxuryCard>
            ) : (
              <>
                {metrics?.connection?.lastSyncedAt == null && (
                  <Text style={s.syncHint}>Your first sync is running — pull back in a moment.</Text>
                )}
                {sections.map((sec) => (
                  <LuxuryCard key={sec.key} style={s.chartCard}>
                    <View style={s.chartHead}>
                      <Text style={s.chartTitle}>{sec.title}</Text>
                      <Text style={s.heroInline}>{sec.hero}</Text>
                    </View>
                    <Text style={s.sectionCaption}>{sec.caption}</Text>

                    <MdbLineChart
                      points={sec.points}
                      height={150}
                      gradientId={`health-${sec.key}`}
                      emptyLabel="Not enough readings for a trend yet"
                    />

                    {sec.points.length >= 2 && (
                      <View style={s.chartFoot}>
                        <Text style={s.chartFootText}>
                          {dayLabel(sec.points[0].date)} ({sec.points[0].y} {sec.unit})
                        </Text>
                        <Text style={s.chartFootText}>
                          {dayLabel(sec.points[sec.points.length - 1].date)} ({sec.points[sec.points.length - 1].y} {sec.unit})
                        </Text>
                      </View>
                    )}
                  </LuxuryCard>
                ))}
              </>
            )}
          </>
        )}

        <View style={{ height: MS.bottomRoom }} />
      </ScrollView>
    </View>
  );
}

function RangePicker({ range, onChange }) {
  return (
    <View style={s.rangeRow}>
      {RANGES.map((r, i) => (
        <React.Fragment key={r}>
          {i > 0 && <Text style={s.rangeSep}>·</Text>}
          <TouchableOpacity onPress={() => onChange(r)} activeOpacity={0.75} hitSlop={6}>
            <Text style={[s.rangeText, r === range && s.rangeTextOn]}>{r}</Text>
          </TouchableOpacity>
        </React.Fragment>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MC.bg },
  topBar: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: MS.hMargin,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: MF.semibold, fontSize: 16, color: MC.text },
  deviceChip: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: MR.xs,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  deviceText: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 0.8,
    textTransform: 'uppercase', color: MC.textTertiary,
  },

  scroll: { paddingHorizontal: MS.hMargin, paddingTop: 16, gap: 12 },

  sectionLabel: {
    fontFamily: MF.semibold, fontSize: 11, letterSpacing: 1.4,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  wearableHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12,
  },
  heroInline: {
    fontFamily: MF.monoSemi, fontSize: 15, color: MC.text,
    fontVariant: ['tabular-nums'],
  },

  loadingBox: { paddingVertical: 32, alignItems: 'center' },
  syncHint: { fontFamily: MF.regular, fontSize: 11, color: MC.textTertiary },

  ctaCard: { padding: 16, gap: 8 },
  ctaTitle: { fontFamily: MF.semibold, fontSize: 13, color: MC.text },
  ctaText: { fontFamily: MF.regular, fontSize: 11, color: MC.textSecondary, lineHeight: 16 },
  ctaBtn: {
    alignSelf: 'flex-start', marginTop: 4,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: MR.pill,
    borderWidth: 1, borderColor: 'rgba(120,61,236,0.60)', backgroundColor: 'rgba(120,61,236,0.10)',
  },
  ctaBtnText: { fontFamily: MF.semibold, fontSize: 11, color: MC.text },

  eyebrow: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  heroCard: { padding: 20, gap: 4 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroValue: {
    fontFamily: MF.monoSemi, fontSize: 36, color: MC.text,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: { fontFamily: MF.regular, fontSize: 16, color: MC.textSecondary },
  heroCaption: { fontFamily: MF.medium, fontSize: 11, color: MC.fresh },
  sectionCaption: { fontFamily: MF.medium, fontSize: 11, color: MC.textSecondary },

  chartCard: { padding: 16, gap: 12 },
  chartHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartTitle: { fontFamily: MF.semibold, fontSize: 13, color: MC.text },
  periodValue: {
    fontFamily: MF.monoSemi, fontSize: 22, color: MC.text,
    fontVariant: ['tabular-nums'], paddingTop: 4,
  },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rangeSep: { color: MC.textTertiary, fontSize: 10 },
  rangeText: { fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary },
  rangeTextOn: { fontFamily: MF.semibold, color: MC.text },
  chartFoot: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
  },
  chartFootText: {
    fontFamily: MF.mono, fontSize: 10, color: MC.textTertiary,
    fontVariant: ['tabular-nums'],
  },
});
