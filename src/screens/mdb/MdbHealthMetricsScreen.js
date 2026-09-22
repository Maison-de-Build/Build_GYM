/**
 * Screen 21 — Health Metrics Detail.
 *
 * One page, top to bottom: today's real calories first (this is where Home's
 * CALORIES BURNED card lands), then the wearable block behind a single DEMO
 * banner. It used to be five tabs in a 38pt row showing one metric at a
 * time, which buried four of the five and made the page feel like five
 * separate screens wearing one hat.
 *
 * ⚠️ DEMO DATA — PRD Part C is unbuilt, so there is no HR / HRV / sleep /
 * recovery source. Per the build instruction those ship laid out exactly as
 * designed with the pack's own sample readings and a persistent DEMO banner,
 * rather than being omitted. Calories is real.
 *
 * The SDNN-vs-RMSSD split is substance, not decoration: the pack is firm that
 * Apple Watch reports SDNN and Whoop reports RMSSD, and that the two must
 * never be averaged into one "HRV" number. That rule is encoded in
 * WEARABLE_SECTIONS below so it survives into the real implementation.
 *
 * To make it real: replace each section's `series` with the device series,
 * key the HRV section off the connected device, and drop DEMO.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MC, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import MdbLineChart from '../../components/mdb/MdbLineChart';
import { LuxuryCard } from '../../components/mdb/MdbPrimitives';
import { fetchDashboard } from '../../services/dashboardService';

const DEMO = true;

// Calories is real data (today's total + a period total from the dashboard
// endpoint) — everything else on this screen is still Part-C demo readings.
const RANGE_TO_PERIOD = { '1W': 'week', '1M': 'month', '3M': 'all', '6M': 'all' };

const WEARABLE_SECTIONS = [
  {
    key: 'hr',
    title: 'Heart Rate',
    heroLabel: 'RESTING HEART RATE',
    hero: '58',
    unit: 'bpm',
    caption: 'Today · Optimal recovery baseline',
    series: [62, 61, 63, 60, 59, 61, 58, 59, 57, 58],
  },
  {
    key: 'hrv',
    title: 'HRV (SDNN)',
    heroLabel: 'HEART RATE VARIABILITY',
    hero: '42',
    unit: 'ms',
    // Apple reports SDNN, Whoop reports RMSSD. They are different statistics
    // and are never mixed — the label always names which one is on screen.
    caption: 'SDNN · Apple Watch. Whoop reports RMSSD separately.',
    series: [38, 40, 37, 41, 43, 39, 42, 44, 41, 42],
  },
  {
    key: 'sleep',
    title: 'Sleep',
    heroLabel: 'LAST NIGHT',
    hero: '7h 22m',
    unit: '',
    caption: 'Deep 1h 18m · REM 1h 42m · Core 4h 22m',
    series: [6.8, 7.1, 6.4, 7.6, 7.2, 6.9, 7.4, 7.0, 7.3, 7.4],
  },
  {
    key: 'recovery',
    title: 'Recovery',
    heroLabel: 'RECOVERY SCORE',
    hero: '68',
    unit: '%',
    caption: 'Whoop 3-zone · Yellow (adequate)',
    series: [54, 61, 58, 72, 66, 70, 63, 69, 71, 68],
  },
];

const RANGES = ['1W', '1M', '3M', '6M'];

export default function MdbHealthMetricsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState('1M');
  const [calData, setCalData] = useState(null);
  const [calLoading, setCalLoading] = useState(true);

  useEffect(() => {
    setCalLoading(true);
    fetchDashboard(RANGE_TO_PERIOD[range] || 'month')
      .then((d) => setCalData(d))
      .catch(() => setCalData(null))
      .finally(() => setCalLoading(false));
  }, [range]);

  const calToday = calData?.combinedCaloriesToday?.total;
  const calBreakdown = calData
    ? `Workout ${calData.combinedCaloriesToday?.workout ?? 0} kcal · Activity ${calData.combinedCaloriesToday?.activity ?? 0} kcal`
    : '';
  const calPeriodTotal = calData?.kpis?.calories;

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      <View style={[s.topBar, { marginTop: insets.top }]}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MdbIcon name="chevron-left" size={20} color={MC.textSecondary} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Health Metrics</Text>
        <View style={s.iconBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* ── Calories — the only real data on this page ─────────────────── */}
        <Text style={s.sectionLabel}>CALORIES</Text>

        <LuxuryCard style={s.heroCard}>
          <Text style={s.eyebrow}>TODAY</Text>
          <View style={s.heroRow}>
            <Text style={s.heroValue}>{calLoading ? '—' : (calToday ?? 0).toLocaleString()}</Text>
            <Text style={s.heroUnit}>kcal</Text>
          </View>
          <Text style={s.heroCaption}>{calLoading ? 'Loading…' : (calBreakdown || 'No sessions logged yet')}</Text>
        </LuxuryCard>

        {/* No real per-day calorie series exists on the backend — only today's
            total and a period total. A fabricated trend line here would be
            exactly the "demo data passed off as real" problem this page is
            meant to avoid, so this gets a period total instead of a chart. */}
        <LuxuryCard style={s.chartCard}>
          <View style={s.chartHead}>
            <Text style={s.chartTitle}>This period</Text>
            <RangePicker range={range} onChange={setRange} />
          </View>
          <Text style={s.periodValue}>
            {calLoading ? '—' : `${(calPeriodTotal ?? 0).toLocaleString()} kcal`}
          </Text>
        </LuxuryCard>

        {/* ── Wearable metrics — one banner for the whole block ──────────── */}
        <View style={s.wearableHead}>
          <Text style={s.sectionLabel}>WEARABLE</Text>
          <View style={s.deviceChip}>
            <Text style={s.deviceText}>Apple Watch</Text>
          </View>
        </View>

        {DEMO && (
          <View style={s.banner}>
            <MdbIcon name="info" size={14} color={MC.warm} />
            <Text style={s.bannerText}>
              Demo data — connect a device to see your own metrics.
            </Text>
          </View>
        )}

        {WEARABLE_SECTIONS.map((sec) => (
          <LuxuryCard key={sec.key} style={s.chartCard}>
            <View style={s.chartHead}>
              <Text style={s.chartTitle}>{sec.title}</Text>
              <Text style={s.heroInline}>
                {sec.hero}{sec.unit ? ` ${sec.unit}` : ''}
              </Text>
            </View>
            <Text style={s.heroCaption}>{sec.caption}</Text>

            <MdbLineChart
              points={sec.series.map((y) => ({ y }))}
              height={150}
              gradientId={`health-${sec.key}`}
            />

            <View style={s.chartFoot}>
              <Text style={s.chartFootText}>
                Start ({sec.series[0]}{sec.unit ? ` ${sec.unit}` : ''})
              </Text>
              <Text style={s.chartFootText}>
                Current ({sec.series[sec.series.length - 1]}{sec.unit ? ` ${sec.unit}` : ''})
              </Text>
            </View>
          </LuxuryCard>
        ))}

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

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: MR.card,
    backgroundColor: 'rgba(245,166,35,0.08)',
    borderWidth: 1, borderColor: 'rgba(245,166,35,0.25)',
  },
  bannerText: { flex: 1, fontFamily: MF.medium, fontSize: 11, color: MC.warm },

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
