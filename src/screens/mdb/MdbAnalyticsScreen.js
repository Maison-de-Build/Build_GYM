/**
 * Screen 09 — Insights (Analytics, no wearable).
 * Port of `screen_09_analytics_dashboard_no_wearable.html`.
 *
 * Stack: lifetime hero (volume / reps) · three range stat cards · the 150px
 * volume bar chart with rest-day baselines and a tappable day readout · the
 * five-factor wellness trend · the 1RM strength chart with an exercise picker ·
 * muscle distribution across ten groups (secondary weighted 50%).
 *
 * Per PRD B.1 there is no wearable scaffolding here at all — no placeholder
 * cards, no "connect a watch" prompt. Screen 08 is the same screen with the
 * biometric blocks added once a device exists; until Part C ships, this is the
 * only state, and its 24px card spacing and taller charts are what fill the page.
 *
 * Range control is Week | Month | All | Custom — Custom opens a day-count picker
 * and drives the same /member/stats/insights?from=&to= call.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl, Modal, Pressable, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { MC, MG, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import MdbLineChart from '../../components/mdb/MdbLineChart';
import { LuxuryCard, EmptyState } from '../../components/mdb/MdbPrimitives';
import { fetchInsights, fetch1rmTrend, fetchStreak, fetchPersonalRecords } from '../../services/workoutService';
import { isoDate, titleCase } from '../../utils/mdbWorkout';

const RANGES = [
  { key: 'week', label: 'Week', days: 7 },
  { key: 'month', label: 'Month', days: 30 },
  { key: 'all', label: 'All', days: null },
  { key: 'custom', label: 'Custom', days: null },
];

// The pack's five wellness factors, in its own order and colours.
const WELLNESS = [
  { key: 'sleep', label: 'Sleep', color: MC.violet },
  { key: 'soreness', label: 'Soreness', color: MC.cyan },
  { key: 'energy', label: 'Energy', color: MC.warm },
  { key: 'stress', label: 'Stress', color: MC.magenta },
  { key: 'mood', label: 'Mood', color: MC.fresh },
];

const DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/**
 * Screen 08 is this same screen with the wearable blocks present — the pack
 * treats 08/09 as two states, not two screens, so they live together here.
 *
 * ⚠️ There is no telemetry source yet (PRD Part C). Per the build instruction
 * the blocks ship with the pack's own sample readings behind a DEMO badge
 * instead of being omitted. When wearables land: read wearableState from
 * /member/dashboard, replace DEMO_BIOMETRICS / DEMO_ZONES with real series, and
 * set WEARABLE_DEMO to false — the section then hides itself for members with
 * no device, which is the PRD B.1 behaviour.
 */
const WEARABLE_DEMO = true;
const DEMO_DEVICE = 'Apple Watch Ultra 2 · Synced 4m ago';
const DEMO_BIOMETRICS = [
  { value: '52 bpm', label: 'Resting HR', sub: '-3 bpm 30-day baseline', tone: MC.cyan },
  { value: '84 ms', label: 'HRV', sub: 'High readiness', tone: MC.fresh },
  { value: '3,120 kcal', label: 'Active Burn', sub: 'Avg 624 kcal / session', tone: MC.textTertiary },
  { value: '16.8', label: 'Cardio Load', sub: 'Optimal zone (14–18)', tone: MC.textTertiary },
];
// Zone 1-5 widths and colours exactly as specified in screen_08's §F.
const DEMO_ZONES = [
  { pct: 12, color: MC.zone1, label: 'Z1' },
  { pct: 28, color: MC.cyan, label: 'Z2' },
  { pct: 34, color: MC.violet, label: 'Z3' },
  { pct: 20, color: MC.zone4, label: 'Z4' },
  { pct: 6, color: MC.warm, label: 'Z5' },
];

export default function MdbAnalyticsScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [range, setRange] = useState('week');
  const [customDays, setCustomDays] = useState(14);
  const [customOpen, setCustomOpen] = useState(false);
  const [draftDays, setDraftDays] = useState('14');

  const [data, setData] = useState(null);
  const [exerciseId, setExerciseId] = useState(null);
  const [trend, setTrend] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedBar, setSelectedBar] = useState(null);
  const [ledger, setLedger] = useState({ streakWeeks: null, prCount: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Lifetime ledger figures come from the existing streak/PR endpoints — these
  // are real, unlike the biometric blocks above them.
  useEffect(() => {
    Promise.allSettled([fetchStreak(), fetchPersonalRecords()]).then(([st, pr]) => {
      setLedger({
        streakWeeks: st.status === 'fulfilled' && st.value?.currentStreak != null
          ? Math.floor(st.value.currentStreak / 7) : null,
        prCount: pr.status === 'fulfilled' && Array.isArray(pr.value) ? pr.value.length : null,
      });
    });
  }, []);

  const { from, to } = useMemo(() => {
    const today = isoDate(new Date());
    if (range === 'all') return { from: '2000-01-01', to: today };
    const days = range === 'custom' ? customDays : RANGES.find((r) => r.key === range).days;
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    return { from: isoDate(d), to: today };
  }, [range, customDays]);

  const load = useCallback(async () => {
    try {
      const d = await fetchInsights(from, to);
      setData(d);
      // Default the strength chart to the member's most-trained lift.
      if (!exerciseId && d?.topExercises?.length) setExerciseId(d.topExercises[0].id);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [from, to, exerciseId]);

  useEffect(() => { setLoading(true); load(); }, [from, to]);

  useEffect(() => {
    if (!exerciseId) return;
    fetch1rmTrend(exerciseId).then((r) => setTrend(Array.isArray(r) ? r : [])).catch(() => setTrend([]));
  }, [exerciseId]);

  const daily = data?.dailyVolume || [];
  const bars = useMemo(() => buildBars(from, to, daily), [from, to, daily]);
  const maxVolume = Math.max(1, ...bars.map((b) => b.volume));
  const muscles = data?.muscleDistribution || [];
  const maxMuscle = Math.max(1, ...muscles.map((m) => m.volume));
  const wellness = data?.wellnessTrend || [];
  const selectedExercise = (data?.topExercises || []).find((e) => e.id === exerciseId);
  const latest1rm = trend.length ? trend[trend.length - 1].est1rm : null;

  const applyCustom = () => {
    const n = Math.max(1, Math.min(365, parseInt(draftDays, 10) || 14));
    setCustomDays(n);
    setRange('custom');
    setCustomOpen(false);
  };

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      {/* ── 44pt top bar with the range toggle ───────────────────────────── */}
      <View style={[s.topBar, { marginTop: insets.top }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MdbIcon name="chevron-left" size={20} color={MC.textSecondary} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Insights</Text>
        <View style={s.rangeRow}>
          {RANGES.map((r, i) => {
            const on = r.key === range;
            return (
              <React.Fragment key={r.key}>
                {i > 0 && <Text style={s.rangeSep}>|</Text>}
                <TouchableOpacity
                  onPress={() => (r.key === 'custom' ? setCustomOpen(true) : setRange(r.key))}
                  activeOpacity={0.75}
                >
                  <Text style={[s.rangeText, on && s.rangeTextOn]}>{r.label}</Text>
                  {on && (
                    <LinearGradient colors={MG.primary} start={MG.startX} end={MG.endX} style={s.rangeUnderline} />
                  )}
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={MC.violetLight} /></View>
      ) : !data ? (
        <EmptyState title="No training data yet" subtitle="Log a workout and your insights build from there." />
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
          {range === 'custom' && (
            <Text style={s.customNote}>Custom range · last {customDays} days</Text>
          )}

          {/* ── Lifetime hero ────────────────────────────────────────────── */}
          <LuxuryCard style={s.heroCard}>
            <View style={[s.heroCell, s.heroDivider]}>
              <Text style={s.heroValue}>
                {data.lifetime.volume.toLocaleString()}
                <Text style={s.heroUnit}> kg</Text>
              </Text>
              <Text style={s.heroLabel}>LIFETIME VOLUME</Text>
            </View>
            <View style={s.heroCell}>
              <Text style={s.heroValue}>{data.lifetime.reps.toLocaleString()}</Text>
              <Text style={s.heroLabel}>LIFETIME REPS</Text>
            </View>
          </LuxuryCard>

          {/* ── Range stat row ───────────────────────────────────────────── */}
          <View style={s.statRow}>
            <StatCard value={`${data.range.volume.toLocaleString()} kg`} label="RANGE VOL" />
            <StatCard value={data.range.reps.toLocaleString()} label="RANGE REPS" />
            <StatCard
              value={`${data.range.sessions} session${data.range.sessions === 1 ? '' : 's'}`}
              label="RANGE"
            />
          </View>

          {/* ── Volume bars ──────────────────────────────────────────────── */}
          <LuxuryCard style={s.chartCard}>
            <View style={s.chartHead}>
              <View>
                <Text style={s.chartTitle}>Training Volume</Text>
                <Text style={s.chartSub}>
                  {bars.length} day{bars.length === 1 ? '' : 's'} · {data.range.volume.toLocaleString()} kg total
                </Text>
              </View>
              <Text style={s.chartTag}>Tonnage</Text>
            </View>

            <View style={s.bars}>
              {bars.map((b) => (
                <TouchableOpacity
                  key={b.date}
                  style={s.barSlot}
                  activeOpacity={b.volume ? 0.7 : 1}
                  onPress={() => b.volume && setSelectedBar(b)}
                >
                  {b.volume > 0 ? (
                    <LinearGradient
                      colors={MG.primary}
                      start={MG.startY}
                      end={MG.endY}
                      style={[
                        s.bar,
                        { height: `${Math.max(4, (b.volume / maxVolume) * 100)}%` },
                        b.isPeak && s.barPeak,
                      ]}
                    />
                  ) : (
                    <View style={s.barRest} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {bars.length <= 14 && (
              <View style={s.barLabels}>
                {bars.map((b) => (
                  <Text key={b.date} style={[s.barLabel, b.isToday && s.barLabelToday]}>
                    {bars.length <= 7 ? DOW[dayIndex(b.date)] : b.date.slice(8)}
                  </Text>
                ))}
              </View>
            )}

            <Text style={s.barTooltip}>
              {selectedBar
                ? `${longDay(selectedBar.date)} · ${selectedBar.volume.toLocaleString()} kg`
                : 'Tap any bar to inspect daily load'}
            </Text>
          </LuxuryCard>

          {/* ── Wellness trend ───────────────────────────────────────────── */}
          <LuxuryCard style={s.chartCard}>
            <View style={s.chartHead}>
              <View style={s.chartHeadLeft}>
                <Text style={s.chartTitle}>Wellness Trends</Text>
                <View style={s.badge}><Text style={s.badgeText}>5 FACTORS</Text></View>
              </View>
            </View>

            {wellness.length < 2 ? (
              <EmptyState
                title="Not enough wellness logs yet"
                subtitle="Answer the post-session survey to build this trend."
                style={{ paddingVertical: 24 }}
              />
            ) : (
              <>
                <View style={s.wellnessChart}>
                  {WELLNESS.map((f, i) => (
                    <View key={f.key} style={StyleSheet.absoluteFill}>
                      <MdbLineChart
                        points={wellness.map((w) => ({ y: w[f.key] })).filter((p) => p.y != null)}
                        height={160}
                        color={f.color}
                        // All five share the survey's 1–5 axis, and only the
                        // bottom layer draws the grid so it isn't stamped 5×.
                        min={1}
                        max={5}
                        showGrid={i === 0}
                        gradientId={`w-${f.key}`}
                      />
                    </View>
                  ))}
                </View>
                <View style={s.legend}>
                  {WELLNESS.map((f) => {
                    const latest = [...wellness].reverse().find((w) => w[f.key] != null);
                    return (
                      <View key={f.key} style={s.legendItem}>
                        <View style={[s.legendDot, { backgroundColor: f.color }]} />
                        <Text style={s.legendText}>
                          {f.label} {latest ? latest[f.key].toFixed(1) : '—'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={s.axisNote}>Current baseline (1–5 scale)</Text>
              </>
            )}
          </LuxuryCard>

          {/* ── Strength trends ──────────────────────────────────────────── */}
          <LuxuryCard style={s.chartCard}>
            <View style={s.chartHead}>
              <Text style={s.chartTitle}>Strength Trends (1RM)</Text>
              <TouchableOpacity
                style={s.picker}
                onPress={() => setPickerOpen(true)}
                activeOpacity={0.8}
                disabled={!(data.topExercises || []).length}
              >
                <Text style={s.pickerText} numberOfLines={1}>
                  {selectedExercise?.name || 'Select exercise'}
                </Text>
                <MdbIcon name="chevron-down" size={12} color={MC.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={s.strengthWrap}>
              <MdbLineChart
                points={trend.map((t) => ({ y: t.est1rm }))}
                height={110}
                gradientId="mdbStrength"
                emptyLabel="Log two weighted sessions to see a trend"
              />
              {latest1rm != null && (
                <View style={s.strengthPill}>
                  <Text style={s.strengthPillText}>{latest1rm} kg</Text>
                </View>
              )}
            </View>

            {trend.length >= 2 && (
              <View style={s.strengthFoot}>
                <Text style={s.strengthFootText}>First logged ({trend[0].est1rm} kg)</Text>
                <Text style={s.strengthFootText}>Current est. 1RM</Text>
              </View>
            )}
          </LuxuryCard>

          {/* ── Biometric telemetry (screen 08 state — demo until Part C) ── */}
          {WEARABLE_DEMO && (
            <View style={s.wearableBlock}>
              <View style={s.devicePill}>
                <View style={s.deviceDot} />
                <Text style={s.deviceText}>{DEMO_DEVICE}</Text>
                <View style={s.demoBadge}><Text style={s.demoBadgeText}>DEMO</Text></View>
              </View>

              <View style={s.bioGrid}>
                {DEMO_BIOMETRICS.map((b) => (
                  <LuxuryCard key={b.label} style={s.bioCard}>
                    <Text style={s.bioValue}>{b.value}</Text>
                    <Text style={s.bioLabel}>{b.label}</Text>
                    <Text style={[s.bioSub, { color: b.tone }]}>{b.sub}</Text>
                  </LuxuryCard>
                ))}
              </View>

              <LuxuryCard style={s.zoneCard}>
                <Text style={s.chartTitle}>Heart Rate Zones</Text>
                <View style={s.zoneBar}>
                  {DEMO_ZONES.map((z) => (
                    <View key={z.label} style={{ flex: z.pct, backgroundColor: z.color, height: '100%' }} />
                  ))}
                </View>
                <View style={s.zoneLegend}>
                  {DEMO_ZONES.map((z) => (
                    <View key={z.label} style={s.zoneLegendItem}>
                      <View style={[s.zoneDot, { backgroundColor: z.color }]} />
                      <Text style={s.zoneLegendText}>{z.label} {z.pct}%</Text>
                    </View>
                  ))}
                </View>
                <Text style={s.zoneCallout}>42 min spent in Zone 3 &amp; 4 (hypertrophy/stamina threshold)</Text>
              </LuxuryCard>
            </View>
          )}

          {/* ── Lifetime studio milestones (real data) ────────────────────── */}
          <LuxuryCard style={s.ledgerCard}>
            <Text style={s.chartTitle}>Lifetime Studio Milestones</Text>
            <LedgerRow label="Total sessions" value={`${data.range.sessions} in range`} />
            <LedgerRow
              label="Lifetime tonnes moved"
              value={`${(data.lifetime.volume / 1000).toFixed(1)} t`}
            />
            {ledger.streakWeeks != null && (
              <LedgerRow label="Active studio streak" value={`${ledger.streakWeeks} weeks`} accent />
            )}
            {ledger.prCount != null && (
              <LedgerRow label="Personal records broken" value={`${ledger.prCount} PRs`} />
            )}
          </LuxuryCard>

          {/* ── Muscle distribution ──────────────────────────────────────── */}
          <LuxuryCard style={s.chartCard}>
            <View style={s.chartHead}>
              <View>
                <Text style={s.chartTitle}>Muscle Distribution</Text>
                <Text style={s.chartSub}>Secondary groups weighted at 50%</Text>
              </View>
              <Text style={s.chartCount}>{muscles.length} Groups</Text>
            </View>

            {muscles.length === 0 ? (
              <EmptyState title="No volume in this range" style={{ paddingVertical: 20 }} />
            ) : (
              <View style={s.muscleList}>
                {muscles.map((m) => (
                  <View key={m.muscleGroup} style={s.muscleRow}>
                    <Text style={s.muscleName} numberOfLines={1}>{titleCase(m.muscleGroup)}</Text>
                    <View style={s.muscleTrack}>
                      <LinearGradient
                        colors={MG.primary}
                        start={MG.startX}
                        end={MG.endX}
                        style={[s.muscleFill, { width: `${(m.volume / maxMuscle) * 100}%` }]}
                      />
                    </View>
                    <Text style={s.muscleValue}>{m.volume.toLocaleString()} kg</Text>
                  </View>
                ))}
              </View>
            )}
          </LuxuryCard>

          <View style={{ height: MS.bottomRoom }} />
        </ScrollView>
      )}

      {/* ── Custom-range sheet ───────────────────────────────────────────── */}
      <Modal visible={customOpen} transparent animationType="fade" onRequestClose={() => setCustomOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setCustomOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.grab} />
            <Text style={s.sheetTitle}>Custom range</Text>
            <Text style={s.sheetSub}>How many days back should Insights cover?</Text>

            <View style={s.presetRow}>
              {[7, 14, 30, 60, 90, 180].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[s.preset, String(n) === draftDays && s.presetOn]}
                  onPress={() => setDraftDays(String(n))}
                  activeOpacity={0.8}
                >
                  <Text style={[s.presetText, String(n) === draftDays && s.presetTextOn]}>{n}d</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={draftDays}
                onChangeText={setDraftDays}
                keyboardType="number-pad"
                maxLength={3}
                selectionColor={MC.violetLight}
              />
              <Text style={s.inputSuffix}>days</Text>
            </View>

            <TouchableOpacity onPress={applyCustom} activeOpacity={0.9}>
              <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.applyBtn}>
                <Text style={s.applyText}>APPLY RANGE</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Exercise picker ──────────────────────────────────────────────── */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setPickerOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.grab} />
            <Text style={s.sheetTitle}>Choose exercise</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {(data?.topExercises || []).map((ex) => (
                <TouchableOpacity
                  key={ex.id}
                  style={s.pickRow}
                  onPress={() => { setExerciseId(ex.id); setPickerOpen(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.pickText, ex.id === exerciseId && s.pickTextOn]} numberOfLines={1}>
                    {ex.name}
                  </Text>
                  {ex.id === exerciseId && <MdbIcon name="check" size={12} color={MC.cyan} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function LedgerRow({ label, value, accent }) {
  return (
    <View style={s.ledgerRow}>
      <Text style={s.ledgerLabel}>{label}</Text>
      <Text style={[s.ledgerValue, accent && { color: MC.warm }]}>{value}</Text>
    </View>
  );
}

function StatCard({ value, label }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statValue} numberOfLines={1}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

/**
 * One bar per calendar day in the range, so rest days render as the pack's 3px
 * baseline capsule rather than collapsing the chart. Capped so an "All" range
 * does not try to draw thousands of bars.
 */
const MAX_BARS = 31;
function buildBars(from, to, daily) {
  const byDate = new Map(daily.map((d) => [d.date, d.volume]));
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const span = Math.round((end - start) / 86400000) + 1;

  // Long ranges show only the trailing window — a 200-bar chart is unreadable
  // on a 390pt screen, and the totals above already carry the whole range.
  const count = Math.min(Math.max(span, 1), MAX_BARS);
  const first = new Date(end);
  first.setUTCDate(end.getUTCDate() - (count - 1));

  const todayIso = isoDate(new Date());
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(first);
    d.setUTCDate(first.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    out.push({ date: iso, volume: byDate.get(iso) || 0, isToday: iso === todayIso });
  }
  const peak = Math.max(0, ...out.map((b) => b.volume));
  return out.map((b) => ({ ...b, isPeak: peak > 0 && b.volume === peak }));
}

const dayIndex = (iso) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;

const longDay = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MC.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: MF.semibold, fontSize: 16, color: MC.text, letterSpacing: -0.2 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rangeSep: { color: 'rgba(255,255,255,0.2)', fontSize: 11 },
  rangeText: { fontFamily: MF.medium, fontSize: 11, color: MC.textTertiary, paddingBottom: 3 },
  rangeTextOn: { color: MC.text },
  rangeUnderline: { height: 2, borderRadius: 1 },

  // space-y-6 (24px) per the no-wearable spec's extra breathing room.
  scroll: { paddingHorizontal: MS.hMargin, paddingTop: 16, gap: 24 },
  customNote: {
    fontFamily: MF.medium, fontSize: 11, color: MC.cyan,
    textAlign: 'center', marginBottom: -12,
  },

  /* Hero */
  heroCard: { flexDirection: 'row', padding: 20 },
  heroCell: { flex: 1, alignItems: 'center' },
  heroDivider: { borderRightWidth: 1, borderRightColor: MC.cardBorder },
  heroValue: {
    fontFamily: MF.monoSemi, fontSize: 26, color: MC.text,
    fontVariant: ['tabular-nums'], marginBottom: 4,
  },
  heroUnit: { fontFamily: MF.regular, fontSize: 14, color: MC.textSecondary },
  heroLabel: {
    fontFamily: MF.semibold, fontSize: 9, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
  },

  /* Range stats */
  statRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4,
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder, borderRadius: MR.card,
  },
  statValue: {
    fontFamily: MF.monoSemi, fontSize: 13, color: MC.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: MF.semibold, fontSize: 8, letterSpacing: 1,
    textTransform: 'uppercase', color: MC.textTertiary, marginTop: 2,
  },

  /* Charts */
  chartCard: { padding: 20, gap: 16 },
  chartHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  chartHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chartTitle: { fontFamily: MF.semibold, fontSize: 14, color: MC.text, letterSpacing: -0.2 },
  chartSub: { fontFamily: MF.regular, fontSize: 11, color: MC.textSecondary, marginTop: 2 },
  chartTag: {
    fontFamily: MF.mono, fontSize: 10, color: MC.cyan,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  chartCount: {
    fontFamily: MF.mono, fontSize: 10, color: MC.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  badge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: MR.xs,
    backgroundColor: 'rgba(6,180,213,0.10)',
    borderWidth: 1, borderColor: 'rgba(6,180,213,0.30)',
  },
  badgeText: {
    fontFamily: MF.semibold, fontSize: 9, letterSpacing: 0.8,
    textTransform: 'uppercase', color: MC.cyan,
  },

  /* Volume bars */
  bars: {
    height: 150, flexDirection: 'row', alignItems: 'flex-end',
    gap: 4, paddingTop: 16, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: MC.cardBorder,
  },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '100%', maxWidth: 22, borderTopLeftRadius: 4, borderTopRightRadius: 4, opacity: 0.85 },
  barPeak: {
    opacity: 1,
    borderTopWidth: 1, borderTopColor: MC.cyan,
    shadowColor: MC.violet, shadowOpacity: 0.5, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  barRest: { width: '100%', maxWidth: 22, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' },
  barLabels: { flexDirection: 'row', gap: 4, marginTop: -8 },
  barLabel: {
    flex: 1, textAlign: 'center',
    fontFamily: MF.mono, fontSize: 9, color: MC.textTertiary,
    textTransform: 'uppercase',
  },
  barLabelToday: { color: MC.text, fontFamily: MF.monoSemi },
  barTooltip: {
    textAlign: 'center', fontFamily: MF.mono, fontSize: 11,
    color: MC.textSecondary, marginTop: -8,
  },

  /* Wellness */
  wellnessChart: { height: 160 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: {
    fontFamily: MF.mono, fontSize: 10, color: MC.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  axisNote: {
    textAlign: 'center', fontFamily: MF.medium, fontSize: 10,
    color: MC.textTertiary,
  },

  /* Strength */
  picker: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 150,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: MR.button,
    backgroundColor: '#120E1A', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  pickerText: { flex: 1, fontFamily: MF.medium, fontSize: 11, color: MC.text },
  strengthWrap: { position: 'relative' },
  strengthPill: {
    position: 'absolute', right: 0, top: -6,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: MR.xs,
    backgroundColor: 'rgba(8,6,11,0.9)',
    borderWidth: 1, borderColor: 'rgba(6,180,213,0.40)',
  },
  strengthPillText: {
    fontFamily: MF.monoSemi, fontSize: 11, color: MC.text,
    fontVariant: ['tabular-nums'],
  },
  strengthFoot: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
  },
  strengthFootText: {
    fontFamily: MF.mono, fontSize: 10, color: MC.textTertiary,
    fontVariant: ['tabular-nums'],
  },

  /* Wearable (screen 08 state) */
  wearableBlock: { gap: 12 },
  devicePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: MR.pill,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: MC.cardBorder,
  },
  deviceDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: MC.fresh },
  deviceText: {
    fontFamily: MF.mono, fontSize: 10, color: MC.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  demoBadge: {
    paddingHorizontal: 5, borderRadius: MR.xs,
    backgroundColor: 'rgba(245,166,35,0.14)',
  },
  demoBadgeText: { fontFamily: MF.semibold, fontSize: 8, letterSpacing: 0.6, color: MC.warm },

  bioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bioCard: { width: '47%', flexGrow: 1, padding: 14, gap: 2 },
  bioValue: {
    fontFamily: MF.monoSemi, fontSize: 22, color: MC.text,
    fontVariant: ['tabular-nums'],
  },
  bioLabel: {
    fontFamily: MF.semibold, fontSize: 9, letterSpacing: 1,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  bioSub: { fontFamily: MF.regular, fontSize: 10, marginTop: 2 },

  zoneCard: { padding: 16, gap: 10 },
  zoneBar: {
    flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  zoneLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  zoneLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  zoneDot: { width: 6, height: 6, borderRadius: 3 },
  zoneLegendText: {
    fontFamily: MF.mono, fontSize: 9, color: MC.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  zoneCallout: { fontFamily: MF.regular, fontSize: 11, color: MC.textSecondary },

  /* Lifetime ledger */
  ledgerCard: { padding: 16, gap: 10 },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ledgerLabel: { fontFamily: MF.regular, fontSize: 12, color: MC.textSecondary },
  ledgerValue: {
    fontFamily: MF.monoSemi, fontSize: 12, color: MC.text,
    fontVariant: ['tabular-nums'],
  },

  /* Muscle distribution */
  muscleList: { gap: 10 },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  muscleName: {
    width: 72, fontFamily: MF.regular, fontSize: 10,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  muscleTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden' },
  muscleFill: { height: '100%', borderRadius: 5 },
  muscleValue: {
    width: 62, textAlign: 'right',
    fontFamily: MF.mono, fontSize: 10, color: MC.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  /* Sheets */
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.70)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0E0B13',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 36, gap: 14,
  },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.20)', alignSelf: 'center' },
  sheetTitle: { fontFamily: MF.semibold, fontSize: 16, color: MC.text },
  sheetSub: { fontFamily: MF.regular, fontSize: 12, color: MC.textSecondary, marginTop: -8 },

  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: MR.button,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: MC.cardBorder,
  },
  presetOn: { borderColor: MC.violet, backgroundColor: 'rgba(120,61,236,0.20)' },
  presetText: { fontFamily: MF.medium, fontSize: 12, color: MC.textSecondary },
  presetTextOn: { color: MC.text },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    width: 80, height: 40, borderRadius: MR.button,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    textAlign: 'center',
    fontFamily: MF.monoSemi, fontSize: 15, color: MC.text,
    paddingVertical: 0,
  },
  inputSuffix: { fontFamily: MF.regular, fontSize: 12, color: MC.textTertiary },

  applyBtn: { height: 44, borderRadius: MR.button, alignItems: 'center', justifyContent: 'center' },
  applyText: {
    fontFamily: MF.semibold, fontSize: 13, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.white,
  },

  pickRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, gap: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  pickText: { flex: 1, fontFamily: MF.medium, fontSize: 13, color: MC.textSecondary },
  pickTextOn: { color: MC.text },
});
