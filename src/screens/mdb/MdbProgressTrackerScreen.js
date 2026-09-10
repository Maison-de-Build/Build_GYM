/**
 * Screen 17 — Progress Tracker (body weight + photo timeline).
 * Port of `screen_17_progress_tracker.html`.
 *
 * Two tabs under a 38pt segment bar with a gradient underline:
 *   Weight — 180px curve with a range filter (1M · 3M · 6M · 1Y · All), the
 *            last-logged line with a neutral month delta, LOG WEIGHT, and the
 *            recent entries list.
 *   Photos — a two-column timeline; long-press deletes.
 *
 * Deltas are stated, never judged — the pack is explicit that this is a private
 * journal, so "+0.4 kg this month" carries no colour coding and no commentary.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image,
  StatusBar, ActivityIndicator, Modal, Pressable, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { MC, MG, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import MdbLineChart from '../../components/mdb/MdbLineChart';
import { LuxuryCard, EmptyState } from '../../components/mdb/MdbPrimitives';
import {
  fetchWeightLog, logWeight, deleteWeight,
  fetchProgressPhotos, addProgressPhotos, deleteProgressPhoto,
} from '../../services/progressService';
import { isoDate } from '../../utils/mdbWorkout';

const RANGES = [
  { key: '1M', months: 1 },
  { key: '3M', months: 3 },
  { key: '6M', months: 6 },
  { key: '1Y', months: 12 },
  { key: 'All', months: null },
];

export default function MdbProgressTrackerScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('weight');
  const [range, setRange] = useState('1M');

  const [entries, setEntries] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [w, p] = await Promise.allSettled([fetchWeightLog(), fetchProgressPhotos()]);
    setEntries(w.status === 'fulfilled' ? (w.value || []) : []);
    setPhotos(p.status === 'fulfilled' ? (p.value || []) : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Oldest → newest, so the chart reads left to right.
  const sorted = useMemo(
    () => [...entries].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [entries],
  );

  const filtered = useMemo(() => {
    const months = RANGES.find((r) => r.key === range)?.months;
    if (!months) return sorted;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const iso = isoDate(cutoff);
    return sorted.filter((e) => String(e.date).slice(0, 10) >= iso);
  }, [sorted, range]);

  const latest = sorted[sorted.length - 1] || null;
  const monthDelta = useMemo(() => computeMonthDelta(sorted), [sorted]);

  const save = async () => {
    const kg = parseFloat(draft);
    if (!Number.isFinite(kg) || kg <= 0) return;
    setSaving(true);
    try {
      await logWeight(kg, isoDate(new Date()));
      setModalOpen(false);
      setDraft('');
      await load();
    } catch (e) {
      Alert.alert('Could not save', e?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = (entry) => {
    Alert.alert('Delete entry?', `${entry.weightKg} kg on ${longDate(entry.date)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => { await deleteWeight(entry.id).catch(() => {}); load(); },
      },
    ]);
  };

  const addPhoto = async (fromCamera) => {
    try {
      const created = await addProgressPhotos(fromCamera);
      if (created) load();
    } catch (e) {
      Alert.alert('Upload failed', e?.message || 'Please try again.');
    }
  };

  const removePhoto = (photo) => {
    Alert.alert('Delete photo?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => { await deleteProgressPhoto(photo.id).catch(() => {}); load(); },
      },
    ]);
  };

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      <View style={[s.topBar, { marginTop: insets.top }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MdbIcon name="chevron-left" size={20} color={MC.textSecondary} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Progress</Text>
        <View style={s.backBtn} />
      </View>

      {/* ── 38pt segment bar ─────────────────────────────────────────────── */}
      <View style={s.segment}>
        {['weight', 'photos'].map((k) => {
          const on = tab === k;
          return (
            <TouchableOpacity key={k} style={s.segmentBtn} onPress={() => setTab(k)} activeOpacity={0.8}>
              <Text style={[s.segmentText, on && s.segmentTextOn]}>
                {k === 'weight' ? 'Weight' : 'Photos'}
              </Text>
              {on && (
                <LinearGradient colors={MG.primary} start={MG.startX} end={MG.endX} style={s.segmentUnderline} />
              )}
            </TouchableOpacity>
          );
        })}
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
          {tab === 'weight' ? (
            <>
              {/* ── Chart card ─────────────────────────────────────────── */}
              <LuxuryCard style={s.chartCard}>
                <View style={s.chartHead}>
                  <Text style={s.chartTitle}>Body Weight</Text>
                  <View style={s.rangeRow}>
                    {RANGES.map((r, i) => (
                      <React.Fragment key={r.key}>
                        {i > 0 && <Text style={s.rangeSep}>·</Text>}
                        <TouchableOpacity onPress={() => setRange(r.key)} activeOpacity={0.75} hitSlop={6}>
                          <Text style={[s.rangeText, r.key === range && s.rangeTextOn]}>{r.key}</Text>
                        </TouchableOpacity>
                      </React.Fragment>
                    ))}
                  </View>
                </View>

                <View style={s.chartWrap}>
                  <MdbLineChart
                    points={filtered.map((e) => ({ y: Number(e.weightKg) }))}
                    height={180}
                    gradientId="mdbWeight"
                    emptyLabel="Log twice to see your curve"
                  />
                  {!!latest && filtered.length >= 2 && (
                    <View style={s.chartPill}>
                      <Text style={s.chartPillText}>{latest.weightKg} kg</Text>
                    </View>
                  )}
                </View>

                <View style={s.chartFoot}>
                  <Text style={s.chartFootLeft}>
                    {latest
                      ? `Last logged: ${latest.weightKg} kg on ${longDate(latest.date)}`
                      : 'No entries yet'}
                  </Text>
                  {monthDelta != null && (
                    <Text style={s.chartFootRight}>
                      {monthDelta >= 0 ? '↑ +' : '↓ '}{Math.abs(monthDelta).toFixed(1)} kg this month
                    </Text>
                  )}
                </View>
              </LuxuryCard>

              {/* ── Log weight ─────────────────────────────────────────── */}
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => { setDraft(latest ? String(latest.weightKg) : ''); setModalOpen(true); }}
              >
                <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.logBtn}>
                  <Text style={s.logBtnText}>LOG WEIGHT</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* ── Recent entries ─────────────────────────────────────── */}
              <LuxuryCard style={{ overflow: 'hidden' }}>
                <View style={s.listHead}>
                  <Text style={s.listHeadText}>RECENT LOG ENTRIES</Text>
                </View>
                {sorted.length === 0 ? (
                  <EmptyState title="Nothing logged yet" style={{ paddingVertical: 24 }} />
                ) : (
                  [...sorted].reverse().slice(0, 10).map((e, i) => (
                    <TouchableOpacity
                      key={e.id}
                      style={[s.entryRow, i > 0 && s.entryDivider]}
                      onLongPress={() => removeEntry(e)}
                      activeOpacity={0.75}
                    >
                      <Text style={s.entryDate}>{longDate(e.date)}</Text>
                      <Text style={s.entryValue}>{e.weightKg} kg</Text>
                    </TouchableOpacity>
                  ))
                )}
              </LuxuryCard>
            </>
          ) : (
            <>
              <View style={s.photoActions}>
                <TouchableOpacity style={s.photoBtn} onPress={() => addPhoto(false)} activeOpacity={0.85}>
                  <MdbIcon name="plus" size={14} color={MC.textSecondary} />
                  <Text style={s.photoBtnText}>Add from gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.photoBtn} onPress={() => addPhoto(true)} activeOpacity={0.85}>
                  <MdbIcon name="camera" size={14} color={MC.textSecondary} />
                  <Text style={s.photoBtnText}>Camera</Text>
                </TouchableOpacity>
              </View>

              {photos.length === 0 ? (
                <EmptyState
                  title="No photos yet"
                  subtitle="Add one and your timeline builds from there."
                />
              ) : (
                <View style={s.photoGrid}>
                  {photos.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={s.photoCell}
                      onLongPress={() => removePhoto(p)}
                      activeOpacity={0.85}
                    >
                      {p.thumbnailUrl || p.url ? (
                        <Image source={{ uri: p.thumbnailUrl || p.url }} style={s.photoImg} />
                      ) : (
                        <View style={[s.photoImg, s.photoFallback]} />
                      )}
                      <View style={s.photoMeta}>
                        <Text style={s.photoLabel} numberOfLines={1}>{p.label || 'Progress'}</Text>
                        <Text style={s.photoDate}>{longDate(p.uploadedAt)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={s.privacyNote}>
                Your photos are private — only you and your coach can see them.
              </Text>
            </>
          )}

          <View style={{ height: MS.bottomRoom }} />
        </ScrollView>
      )}

      {/* ── Log weight sheet ─────────────────────────────────────────────── */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setModalOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.grab} />
            <Text style={s.sheetTitle}>Log Body Weight</Text>

            <View style={s.weightInputRow}>
              <TextInput
                style={s.weightInput}
                value={draft}
                onChangeText={setDraft}
                keyboardType="decimal-pad"
                placeholder="0.0"
                placeholderTextColor={MC.textTertiary}
                selectionColor={MC.violetLight}
                autoFocus
              />
              <Text style={s.weightUnit}>kg</Text>
            </View>

            <Text style={s.timestamp}>
              Timestamp: Today, {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </Text>

            <TouchableOpacity onPress={save} activeOpacity={0.9} disabled={saving}>
              <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.saveBtn}>
                <Text style={s.saveText}>{saving ? 'SAVING…' : 'SAVE ENTRY'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** Latest weight minus the closest entry ~30 days back. Null if there isn't one. */
function computeMonthDelta(sorted) {
  if (sorted.length < 2) return null;
  const latest = sorted[sorted.length - 1];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const iso = isoDate(cutoff);
  const older = [...sorted].reverse().find((e) => String(e.date).slice(0, 10) <= iso);
  if (!older) return null;
  return Number(latest.weightKg) - Number(older.weightKg);
}

function longDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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

  segment: {
    height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    borderBottomWidth: 1, borderBottomColor: MC.cardBorder,
  },
  segmentBtn: { alignItems: 'center', paddingBottom: 6 },
  segmentText: { fontFamily: MF.medium, fontSize: 13, color: MC.textTertiary },
  segmentTextOn: { color: MC.text },
  segmentUnderline: { height: 2, borderRadius: 1, alignSelf: 'stretch', marginTop: 4 },

  scroll: { paddingHorizontal: MS.hMargin, paddingTop: 16, gap: 16 },

  chartCard: { padding: 16, gap: 12 },
  chartHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartTitle: { fontFamily: MF.semibold, fontSize: 14, color: MC.text },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rangeSep: { color: MC.textTertiary, fontSize: 10 },
  rangeText: { fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary },
  rangeTextOn: { fontFamily: MF.semibold, color: MC.text },

  chartWrap: { position: 'relative' },
  chartPill: {
    position: 'absolute', right: 0, top: 26,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: MR.xs,
    backgroundColor: MC.bg, borderWidth: 1, borderColor: 'rgba(6,180,213,0.40)',
  },
  chartPillText: {
    fontFamily: MF.monoSemi, fontSize: 11, color: MC.text,
    fontVariant: ['tabular-nums'],
  },
  chartFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
  },
  chartFootLeft: { fontFamily: MF.regular, fontSize: 11, color: MC.textTertiary, flexShrink: 1 },
  chartFootRight: {
    fontFamily: MF.mono, fontSize: 11, color: MC.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  logBtn: { height: 44, borderRadius: MR.button, alignItems: 'center', justifyContent: 'center' },
  logBtnText: {
    fontFamily: MF.semibold, fontSize: 13, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.white,
  },

  listHead: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: MC.cardBorder,
  },
  listHeadText: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  entryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12,
  },
  entryDivider: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  entryDate: {
    fontFamily: MF.mono, fontSize: 12, color: MC.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  entryValue: {
    fontFamily: MF.monoSemi, fontSize: 12, color: MC.text,
    fontVariant: ['tabular-nums'],
  },

  photoActions: { flexDirection: 'row', gap: 8 },
  photoBtn: {
    flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder, borderRadius: MR.button,
  },
  photoBtnText: { fontFamily: MF.medium, fontSize: 12, color: MC.textSecondary },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoCell: {
    width: '47%', flexGrow: 1,
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder,
    borderRadius: MR.card, overflow: 'hidden',
  },
  photoImg: { width: '100%', aspectRatio: 1, backgroundColor: 'rgba(255,255,255,0.02)' },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  photoMeta: { padding: 8 },
  photoLabel: { fontFamily: MF.semibold, fontSize: 11, color: MC.text },
  photoDate: { fontFamily: MF.regular, fontSize: 9, color: MC.textTertiary, marginTop: 1 },
  privacyNote: {
    textAlign: 'center', fontFamily: MF.regular, fontSize: 10,
    color: MC.textTertiary, paddingTop: 4,
  },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.80)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#100D18',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36, gap: 20,
  },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.20)', alignSelf: 'center' },
  sheetTitle: { fontFamily: MF.semibold, fontSize: 16, color: MC.text, textAlign: 'center' },
  weightInputRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 },
  weightInput: {
    width: 144, textAlign: 'center',
    fontFamily: MF.monoSemi, fontSize: 40, color: MC.text,
    fontVariant: ['tabular-nums'],
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.20)',
    paddingBottom: 4,
  },
  weightUnit: { fontFamily: MF.regular, fontSize: 18, color: MC.textTertiary },
  timestamp: { textAlign: 'center', fontFamily: MF.regular, fontSize: 12, color: MC.textTertiary },
  saveBtn: { height: 44, borderRadius: MR.button, alignItems: 'center', justifyContent: 'center' },
  saveText: {
    fontFamily: MF.semibold, fontSize: 12, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.white,
  },
});
