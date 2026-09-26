/**
 * Screen 18 — Devices (wearable connections).
 * Port of `screen_18_wearable_settings.html`, now live for Apple Health.
 *
 * Apple Health (iOS only):
 *   Connect → iOS Health permission sheet (read-only) → backend connect →
 *   first sync (30-day backfill). Afterwards the app syncs on every foreground
 *   (useAppleHealthAutoSync) and "Sync now" forces one.
 *   Disconnect stops syncing and hides the data; reconnecting restores it.
 *
 * iOS never tells an app which READ types were allowed — a switched-off type
 * just returns nothing. So this screen never claims "Heart rate: Enabled"; it
 * lists what we ask for and says where to change it.
 *
 * Whoop is shown as "Coming soon" (separate phase). Trainer sharing (PRD C.4)
 * is not built yet, so its toggle is not rendered.
 *
 * "Sync details" exists for testing through TestFlight: there is no debugger
 * on a tester's phone, so the last sync report is shown and copyable.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  ActivityIndicator, Alert, Platform, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';

import { MC, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import { LuxuryCard } from '../../components/mdb/MdbPrimitives';
import {
  fetchWearableConnections, connectAppleHealth, disconnectAppleHealth,
} from '../../services/wearableService';
import * as AppleHealth from '../../services/wearables/appleHealth';
import {
  runAppleSync, getLastDiagnostics, formatDiagnostics,
} from '../../services/wearables/appleSync';

const IS_IOS = Platform.OS === 'ios';

const READS = [
  'Heart rate & resting heart rate',
  'Heart rate variability (HRV)',
  'Sleep',
  'Active calories',
  'Workouts',
];

function agoLabel(iso) {
  if (!iso) return null;
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function MdbWearableSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [available, setAvailable] = useState(null); // null = checking
  const [apple, setApple] = useState(null);          // shaped connection or null
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(null);            // 'connect' | 'sync' | 'disconnect'
  const [notice, setNotice] = useState(null);        // { tone: 'ok'|'warn'|'error', text }
  const [diag, setDiag] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const connected = apple?.status === 'connected';

  const load = useCallback(async () => {
    try {
      const [conns, avail, d] = await Promise.all([
        fetchWearableConnections(),
        IS_IOS ? AppleHealth.isAvailable() : Promise.resolve(false),
        IS_IOS ? getLastDiagnostics() : Promise.resolve(null),
      ]);
      setApple(conns.find((c) => c.provider === 'apple') || null);
      setAvailable(avail);
      setDiag(d);
      setLoadError(null);
    } catch {
      setLoadError('Could not load your devices. Pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh on focus so "synced Xm ago" is current after an auto-sync.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const reportSync = useCallback((res, { afterConnect = false } = {}) => {
    setDiag(res.diag);
    if (!res.ok) {
      setNotice({
        tone: 'error',
        text: res.code === 'NOT_CONNECTED'
          ? 'Apple Health is not connected any more. Tap Connect.'
          : `Sync failed. ${res.error || ''}`.trim(),
      });
      return;
    }
    const { acceptedDays = 0, acceptedWorkouts = 0 } = res.result || {};
    if (acceptedDays === 0 && acceptedWorkouts === 0) {
      setNotice({
        tone: 'warn',
        text: afterConnect
          ? 'Connected, but no health data came through. If you turned any categories off, open the Health app → your profile picture → Apps → Maison de Build, switch them on, then tap Sync now.'
          : 'No new health data found. If this is unexpected, check access in the Health app → your profile picture → Apps → Maison de Build.',
      });
    } else {
      setNotice({
        tone: 'ok',
        text: `Synced ${acceptedDays} day${acceptedDays === 1 ? '' : 's'} and ${acceptedWorkouts} workout${acceptedWorkouts === 1 ? '' : 's'}.`,
      });
    }
  }, []);

  const onConnect = useCallback(async () => {
    setBusy('connect');
    setNotice(null);
    try {
      await AppleHealth.requestPermission();
      const conn = await connectAppleHealth(AppleHealth.READ_TYPES);
      setApple(conn);
      setBusy('sync');
      const res = await runAppleSync({ lastSyncedAt: conn?.lastSyncedAt ?? null, reason: 'connect' });
      reportSync(res, { afterConnect: true });
    } catch (err) {
      let text;
      if (err?.response) text = `The server returned an error (${err.response.status}). Please try again.`;
      else if (err?.request) text = 'Could not reach the server. Check your connection and try again.';
      else text = `Could not connect Apple Health. ${err?.message || ''}`.trim();
      setNotice({ tone: 'error', text });
    } finally {
      setBusy(null);
      load();
    }
  }, [load, reportSync]);

  const onSyncNow = useCallback(async () => {
    setBusy('sync');
    setNotice(null);
    try {
      const res = await runAppleSync({ lastSyncedAt: apple?.lastSyncedAt ?? null, reason: 'manual' });
      reportSync(res);
    } finally {
      setBusy(null);
      load();
    }
  }, [apple?.lastSyncedAt, load, reportSync]);

  const onDisconnect = useCallback(() => {
    Alert.alert(
      'Disconnect Apple Health?',
      'The app will stop reading from Apple Health and your synced heart rate, sleep and Watch workouts will be hidden. Reconnect any time to bring them back.\n\nTo also revoke access on your iPhone, use the Health app → your profile picture → Apps → Maison de Build.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setBusy('disconnect');
            setNotice(null);
            try {
              const conn = await disconnectAppleHealth();
              setApple(conn);
              setNotice({ tone: 'ok', text: 'Apple Health disconnected.' });
            } catch {
              setNotice({ tone: 'error', text: 'Could not disconnect. Check your connection and try again.' });
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }, []);

  const onCopyDetails = useCallback(async () => {
    await Clipboard.setStringAsync(formatDiagnostics(diag));
    setNotice({ tone: 'ok', text: 'Sync details copied — paste them into a message.' });
  }, [diag]);

  const appleState = (() => {
    if (busy === 'connect') return 'Connecting…';
    if (busy === 'sync') return 'Syncing…';
    if (busy === 'disconnect') return 'Disconnecting…';
    if (!connected) return 'Not connected';
    return apple?.lastSyncedAt ? `Connected · synced ${agoLabel(apple.lastSyncedAt)}` : 'Connected · not synced yet';
  })();

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      <View style={[s.topBar, { marginTop: insets.top }]}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MdbIcon name="chevron-left" size={20} color={MC.textSecondary} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Devices</Text>
        <View style={s.iconBtn} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={MC.violetLight} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
              tintColor={MC.violetLight}
            />
          )}
        >
          {!!loadError && <Banner tone="error" text={loadError} />}
          {!!notice && <Banner tone={notice.tone} text={notice.text} />}

          {/* ── Apple Health ───────────────────────────────────────────── */}
          {IS_IOS && (
            <LuxuryCard style={s.deviceCard}>
              <View style={s.deviceRow}>
                <View style={s.deviceLeft}>
                  <View style={s.deviceIcon}>
                    <MdbIcon name="heart" size={20} color={connected ? MC.fresh : MC.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.deviceName}>Apple Health</Text>
                    <Text style={s.deviceSub}>Apple Watch · iPhone</Text>
                    <Text style={[s.deviceState, connected && !busy && { color: MC.fresh }]}>{appleState}</Text>
                  </View>
                </View>

                {available === false ? null : busy ? (
                  <ActivityIndicator color={MC.violetLight} />
                ) : connected ? (
                  <TouchableOpacity style={s.connectBtn} onPress={onSyncNow} activeOpacity={0.85}>
                    <Text style={s.connectText}>Sync now</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={s.connectBtn} onPress={onConnect} activeOpacity={0.85}>
                    <Text style={s.connectText}>Connect</Text>
                  </TouchableOpacity>
                )}
              </View>

              {available === false && (
                <Text style={s.unavailable}>
                  Apple Health isn't available on this device.
                </Text>
              )}

              {connected && !busy && (
                <TouchableOpacity onPress={onDisconnect} activeOpacity={0.7} hitSlop={8} style={s.disconnect}>
                  <Text style={s.disconnectText}>Disconnect</Text>
                </TouchableOpacity>
              )}
            </LuxuryCard>
          )}

          {/* ── Whoop — separate phase ─────────────────────────────────── */}
          <LuxuryCard style={[s.deviceCard, IS_IOS && { marginTop: 16 }]}>
            <View style={s.deviceRow}>
              <View style={s.deviceLeft}>
                <View style={s.deviceIcon}>
                  <MdbIcon name="activity" size={20} color={MC.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.deviceName}>Whoop</Text>
                  <Text style={s.deviceState}>Coming soon</Text>
                </View>
              </View>
              <View style={s.soonPill}>
                <Text style={s.soonText}>Soon</Text>
              </View>
            </View>
          </LuxuryCard>

          {/* ── What we read ───────────────────────────────────────────── */}
          {IS_IOS && available !== false && (
            <LuxuryCard style={[s.permCard, { marginTop: 16 }]}>
              <View style={s.permHead}>
                <Text style={s.eyebrow}>WHAT WE READ</Text>
                <Text style={s.permSource}>Read only</Text>
              </View>
              <View style={s.permList}>
                {READS.map((label) => (
                  <View key={label} style={s.permRow}>
                    <MdbIcon name="check" size={12} color={MC.textTertiary} />
                    <Text style={s.permLabel}>{label}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.permNote}>
                We never write to Apple Health. To choose exactly what the app can read, open the
                Health app → your profile picture → Apps → Maison de Build.
              </Text>
              <Text style={s.permNote}>
                Workouts from your Watch appear in your history but don't count toward studio
                streaks, the leaderboard or Build Coins.
              </Text>
            </LuxuryCard>
          )}

          {/* ── Sync details (for testing / support) ───────────────────── */}
          {IS_IOS && (connected || diag) && (
            <LuxuryCard style={[s.permCard, { marginTop: 16 }]}>
              <TouchableOpacity
                style={s.detailsHead}
                onPress={() => setShowDetails((v) => !v)}
                activeOpacity={0.75}
              >
                <Text style={s.eyebrow}>SYNC DETAILS</Text>
                <MdbIcon name={showDetails ? 'chevron-up' : 'chevron-down'} size={14} color={MC.textTertiary} />
              </TouchableOpacity>
              {showDetails && (
                <>
                  <Text style={s.detailsText}>{formatDiagnostics(diag)}</Text>
                  <TouchableOpacity style={s.copyBtn} onPress={onCopyDetails} activeOpacity={0.85}>
                    <Text style={s.copyText}>Copy details</Text>
                  </TouchableOpacity>
                </>
              )}
            </LuxuryCard>
          )}

          <Text style={s.legal}>
            Your health data is encrypted and never sold or used for advertising.
          </Text>
          <View style={{ height: MS.bottomRoom }} />
        </ScrollView>
      )}
    </View>
  );
}

function Banner({ tone, text }) {
  const color = tone === 'ok' ? MC.fresh : tone === 'warn' ? MC.warm : MC.workedSolid;
  return (
    <View style={[s.banner, { borderColor: color }]}>
      <MdbIcon name="info" size={14} color={color} />
      <Text style={[s.bannerText, { color }]}>{text}</Text>
    </View>
  );
}

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

  scroll: { paddingHorizontal: MS.hMargin, paddingTop: 16 },

  banner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 12, marginBottom: 16, borderRadius: MR.card,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1,
  },
  bannerText: { flex: 1, fontFamily: MF.medium, fontSize: 11, lineHeight: 16 },

  deviceCard: { padding: 16, gap: 12 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  deviceLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  deviceIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  deviceName: { fontFamily: MF.semibold, fontSize: 14, color: MC.text },
  deviceSub: { fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary, marginTop: 1 },
  deviceState: { fontFamily: MF.regular, fontSize: 11, color: MC.textTertiary, marginTop: 3 },
  connectBtn: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: MR.pill,
    borderWidth: 1, borderColor: 'rgba(120,61,236,0.60)', backgroundColor: 'rgba(120,61,236,0.10)',
  },
  connectText: { fontFamily: MF.semibold, fontSize: 11, color: MC.text },
  unavailable: { fontFamily: MF.regular, fontSize: 11, color: MC.textSecondary, lineHeight: 16 },
  disconnect: { alignSelf: 'flex-start' },
  disconnectText: { fontFamily: MF.medium, fontSize: 11, color: MC.textTertiary, textDecorationLine: 'underline' },
  soonPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: MR.pill,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  soonText: { fontFamily: MF.semibold, fontSize: 10, color: MC.textTertiary, letterSpacing: 0.6, textTransform: 'uppercase' },

  eyebrow: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  permCard: { padding: 16, gap: 10 },
  permHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  permSource: { fontFamily: MF.regular, fontSize: 10, color: MC.cyan },
  permList: { gap: 6 },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  permLabel: { fontFamily: MF.regular, fontSize: 11, color: MC.textSecondary },
  permNote: { fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary, lineHeight: 15 },

  detailsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailsText: {
    fontFamily: MF.mono, fontSize: 10, color: MC.textSecondary, lineHeight: 15,
  },
  copyBtn: {
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: MR.pill,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  copyText: { fontFamily: MF.semibold, fontSize: 11, color: MC.text },

  legal: {
    textAlign: 'center', fontFamily: MF.regular, fontSize: 9,
    color: MC.textTertiary, paddingHorizontal: 8, paddingTop: 16, lineHeight: 14,
  },
});
