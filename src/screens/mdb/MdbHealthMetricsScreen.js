/**
 * Screen 21 — Health Metrics Detail (wearable deep-dive).
 * Port of `screen_21_health_metrics_detail.html`.
 *
 * ⚠️ DEMO DATA — PRD Part C is unbuilt, so there is no HR / HRV / sleep /
 * recovery source. Per the build instruction the screen ships laid out exactly
 * as designed with the pack's own sample readings and a persistent DEMO banner,
 * rather than being omitted.
 *
 * The four tabs and the SDNN-vs-RMSSD split are the substance here: the pack is
 * firm that Apple Watch reports SDNN and Whoop reports RMSSD, and that the two
 * must never be averaged into one "HRV" number. That rule is encoded in TABS
 * below so it survives into the real implementation.
 *
 * To make it real: replace DEMO_SERIES with the device series, key the HRV tab
 * off the connected device, and drop DEMO.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { MC, MG, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import MdbLineChart from '../../components/mdb/MdbLineChart';
import { LuxuryCard } from '../../components/mdb/MdbPrimitives';
import { fetchDashboard } from '../../services/dashboardService';

const DEMO = true;

// Calories is real data (today's total + a period total from the dashboard
// endpoint) — everything else on this screen is still Part-C demo readings.
const RANGE_TO_PERIOD = { '1W': 'week', '1M': 'month', '3M': 'all', '6M': 'all' };

const TABS = [
  {
    key: 'calories',
    label: 'Calories',
    title: 'Calories',
    real: true,
  },
  {
    key: 'hr',
    label: 'Heart Rate',
    title: 'Heart Rate',
    heroLabel: 'RESTING HEART RATE',
    hero: '58',
    unit: 'bpm',
    caption: 'Today · Optimal recovery baseline',
    series: [62, 61, 63, 60, 59, 61, 58, 59, 57, 58],
  },
  {
    key: 'hrv',
    label: 'HRV',
    title: 'HRV (SDNN)',
    heroLabel: 'HEART RATE VARIABILITY',
    hero: '42',
    unit: 'ms',
    // Apple reports SDNN, Whoop reports RMSSD. They are different statistics and
    // are never mixed — the label always names which one is on screen.
    caption: 'SDNN · Apple Watch. Whoop reports RMSSD separately.',
    series: [38, 40, 37, 41, 43, 39, 42, 44, 41, 42],
  },
  {
    key: 'sleep',
    label: 'Sleep',
    title: 'Sleep',
    heroLabel: 'LAST NIGHT',
    hero: '7h 22m',
    unit: '',
    caption: 'Deep 1h 18m · REM 1h 42m · Core 4h 22m',
    series: [6.8, 7.1, 6.4, 7.6, 7.2, 6.9, 7.4, 7.0, 7.3, 7.4],
  },
  {
    key: 'recovery',
    label: 'Recovery',
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
  const [tabKey, setTabKey] = useState(route?.params?.metric || 'calories');
  const [range, setRange] = useState('1M');
  const [calData, setCalData] = useState(null);
  const [calLoading, setCalLoading] = useState(true);

  const tab = TABS.find((t) => t.key === tabKey) || TABS[0];

  useEffect(() => {
    if (tab.key !== 'calories') return;
    setCalLoading(true);
    fetchDashboard(RANGE_TO_PERIOD[range] || 'month')
      .then((d) => setCalData(d))
      .catch(() => setCalData(null))
      .finally(() => setCalLoading(false));
  }, [tab.key, range]);

  const isCalories = tab.key === 'calories';
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
        <Text style={s.topTitle}>{tab.title}</Text>
        {isCalories ? <View style={s.iconBtn} /> : (
          <View style={s.deviceChip}>
            <Text style={s.deviceText}>Apple Watch</Text>
          </View>
        )}
      </View>

      {/* ── 4 segment tabs ───────────────────────────────────────────────── */}
      <View style={s.segment}>
        {TABS.map((t) => {
          const on = t.key === tabKey;
          return (
            <TouchableOpacity key={t.key} style={s.segmentBtn} onPress={() => setTabKey(t.key)} activeOpacity={0.8}>
              <Text style={[s.segmentText, on && s.segmentTextOn]}>{t.label}</Text>
              {on && (
                <LinearGradient colors={MG.primary} start={MG.startX} end={MG.endX} style={s.segmentUnderline} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {DEMO && !isCalories && (
          <View style={s.banner}>
            <MdbIcon name="info" size={14} color={MC.warm} />
            <Text style={s.bannerText}>
              Demo data — connect a device to see your own metrics.
            </Text>
          </View>
        )}

        {isCalories ? (
          <LuxuryCard style={s.heroCard}>
            <Text style={s.eyebrow}>TODAY</Text>
            <View style={s.heroRow}>
              <Text style={s.heroValue}>{calLoading ? '—' : (calToday ?? 0).toLocaleString()}</Text>
              <Text style={s.heroUnit}>kcal</Text>
            </View>
            <Text style={s.heroCaption}>{calLoading ? 'Loading…' : (calBreakdown || 'No sessions logged yet')}</Text>
          </LuxuryCard>
        ) : (
          <LuxuryCard style={s.heroCard}>
            <Text style={s.eyebrow}>{tab.heroLabel}</Text>
            <View style={s.heroRow}>
              <Text style={s.heroValue}>{tab.hero}</Text>
              {!!tab.unit && <Text style={s.heroUnit}>{tab.unit}</Text>}
            </View>
            <Text style={s.heroCaption}>{tab.caption}</Text>
          </LuxuryCard>
        )}

        {isCalories ? (
          // No real per-day calorie series exists yet on the backend — showing
          // a fabricated trend here would be exactly the "demo data as real"
          // problem this split exists to fix, so this tab gets a period total
          // instead of a chart.
          <LuxuryCard style={s.chartCard}>
            <View style={s.chartHead}>
              <Text style={s.chartTitle}>This period</Text>
              <View style={s.rangeRow}>
                {RANGES.map((r, i) => (
                  <React.Fragment key={r}>
                    {i > 0 && <Text style={s.rangeSep}>·</Text>}
                    <TouchableOpacity onPress={() => setRange(r)} activeOpacity={0.75} hitSlop={6}>
                      <Text style={[s.rangeText, r === range && s.rangeTextOn]}>{r}</Text>
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </View>
            </View>
            <Text style={s.periodValue}>
              {calLoading ? '—' : `${(calPeriodTotal ?? 0).toLocaleString()} kcal`}
            </Text>
          </LuxuryCard>
        ) : (
        <LuxuryCard style={s.chartCard}>
          <View style={s.chartHead}>
            <Text style={s.chartTitle}>Trend</Text>
            <View style={s.rangeRow}>
              {RANGES.map((r, i) => (
                <React.Fragment key={r}>
                  {i > 0 && <Text style={s.rangeSep}>·</Text>}
                  <TouchableOpacity onPress={() => setRange(r)} activeOpacity={0.75} hitSlop={6}>
                    <Text style={[s.rangeText, r === range && s.rangeTextOn]}>{r}</Text>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          </View>

          <MdbLineChart
            points={tab.series.map((y) => ({ y }))}
            height={180}
            gradientId={`health-${tab.key}`}
          />

          <View style={s.chartFoot}>
            <Text style={s.chartFootText}>
              Start ({tab.series[0]}{tab.unit ? ` ${tab.unit}` : ''})
            </Text>
            <Text style={s.chartFootText}>
              Current ({tab.series[tab.series.length - 1]}{tab.unit ? ` ${tab.unit}` : ''})
            </Text>
          </View>
        </LuxuryCard>
        )}

        <View style={{ height: MS.bottomRoom }} />
      </ScrollView>
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

  segment: {
    height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    borderBottomWidth: 1, borderBottomColor: MC.cardBorder,
  },
  segmentBtn: { alignItems: 'center', paddingBottom: 6 },
  segmentText: { fontFamily: MF.medium, fontSize: 12, color: MC.textTertiary },
  segmentTextOn: { color: MC.text },
  segmentUnderline: { height: 2, borderRadius: 1, alignSelf: 'stretch', marginTop: 4 },

  scroll: { paddingHorizontal: MS.hMargin, paddingTop: 16, gap: 16 },

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
