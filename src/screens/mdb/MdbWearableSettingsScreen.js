/**
 * Screen 18 — Wearable Connection Settings.
 * Port of `screen_18_wearable_settings.html`.
 *
 * ⚠️ NOT FUNCTIONAL YET — PRD Part C (wearables) is unbuilt: there is no
 * HealthKit bridge, no Whoop OAuth, and no consent column in the database.
 * Per the build instruction this ships laid out exactly as designed, with every
 * control **disabled** and a banner saying so, rather than being omitted.
 *
 * To make it real: wire Connect/Disconnect to the HealthKit + Whoop PKCE flows,
 * back the consent toggle with a persisted per-trainer row (revoked on coach
 * reassignment, PRD C.4), then drop DISABLED below.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MC, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import { LuxuryCard } from '../../components/mdb/MdbPrimitives';
import useMemberMode from '../../hooks/useMemberMode';

const DISABLED = true;

const PERMISSIONS = [
  { label: 'Heart rate & HRV', state: 'Enabled' },
  { label: 'Sleep stages & duration', state: 'Enabled' },
  { label: 'Workouts & active calories', state: 'Enabled' },
  { label: 'Body weight telemetry', state: 'Optional' },
];

export default function MdbWearableSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { isPt, trainer } = useMemberMode();
  const [consent, setConsent] = useState(false);

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {DISABLED && (
          <View style={s.banner}>
            <MdbIcon name="info" size={14} color={MC.warm} />
            <Text style={s.bannerText}>
              Device sync is coming soon — these controls are previewed but not active yet.
            </Text>
          </View>
        )}

        <View style={DISABLED ? s.inert : null} pointerEvents={DISABLED ? 'none' : 'auto'}>
          {/* ── Apple Watch ─────────────────────────────────────────────── */}
          <LuxuryCard style={s.deviceCard}>
            <View style={s.deviceLeft}>
              <View style={s.deviceIcon}>
                <MdbIcon name="watch" size={20} color={MC.textSecondary} />
              </View>
              <View>
                <Text style={s.deviceName}>Apple Watch</Text>
                <Text style={s.deviceState}>Not connected</Text>
              </View>
            </View>
            <TouchableOpacity style={s.connectBtn} activeOpacity={0.85}>
              <Text style={s.connectText}>Connect</Text>
            </TouchableOpacity>
          </LuxuryCard>

          {/* ── Whoop ───────────────────────────────────────────────────── */}
          <LuxuryCard style={[s.deviceCard, { marginTop: 16 }]}>
            <View style={s.deviceLeft}>
              <View style={s.deviceIcon}>
                <MdbIcon name="activity" size={20} color={MC.textSecondary} />
              </View>
              <View>
                <Text style={s.deviceName}>Whoop</Text>
                <Text style={s.deviceState}>Not connected</Text>
              </View>
            </View>
            <TouchableOpacity style={s.connectBtn} activeOpacity={0.85}>
              <Text style={s.connectText}>Connect</Text>
            </TouchableOpacity>
          </LuxuryCard>

          {/* ── Data permissions ────────────────────────────────────────── */}
          <LuxuryCard style={[s.permCard, { marginTop: 16 }]}>
            <View style={s.permHead}>
              <Text style={s.eyebrow}>DATA PERMISSIONS</Text>
              <Text style={s.permSource}>Apple Health</Text>
            </View>
            <View style={s.permList}>
              {PERMISSIONS.map((p) => (
                <View key={p.label} style={s.permRow}>
                  <Text style={s.permLabel}>{p.label}</Text>
                  <Text style={[s.permState, p.state === 'Enabled' && { color: MC.fresh }]}>
                    {p.state === 'Enabled' ? '✓ Enabled' : p.state}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={s.permNote}>
              Manage granular device permissions in iOS Settings → Health.
            </Text>
          </LuxuryCard>

          {/* ── Trainer sharing consent (PT members only) ───────────────── */}
          {isPt && (
            <LuxuryCard style={[s.consentCard, { marginTop: 16 }]}>
              <View style={s.consentHead}>
                <Text style={s.consentTitle}>Share with your trainer</Text>
                <TouchableOpacity
                  style={[s.toggle, consent && s.toggleOn]}
                  onPress={() => setConsent((v) => !v)}
                  activeOpacity={0.85}
                >
                  <View style={[s.knob, consent && s.knobOn]} />
                </TouchableOpacity>
              </View>

              <Text style={s.consentBody}>
                Allow {trainer?.fullName ? `Coach ${trainer.fullName.split(' ')[0]}` : 'your coach'} to view
                cardiovascular health trends (resting HR, HRV, and sleep stages) for recovery planning.
              </Text>

              <View style={s.consentFine}>
                <Text style={s.consentFineText}>
                  Shared: heart rate, HRV, sleep. Never shared: body weight, progress photos, raw set logs.
                  Consent is trainer-specific and revokes automatically on coach reassignment.
                </Text>
              </View>
            </LuxuryCard>
          )}
        </View>

        <Text style={s.legal}>
          Your biometric data is encrypted at rest and never sold or shared with external third parties.
        </Text>
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

  scroll: { paddingHorizontal: MS.hMargin, paddingTop: 16 },
  inert: { opacity: 0.55 },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, marginBottom: 16, borderRadius: MR.card,
    backgroundColor: 'rgba(245,166,35,0.08)',
    borderWidth: 1, borderColor: 'rgba(245,166,35,0.25)',
  },
  bannerText: { flex: 1, fontFamily: MF.medium, fontSize: 11, color: MC.warm, lineHeight: 16 },

  deviceCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, gap: 12,
  },
  deviceLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  deviceIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  deviceName: { fontFamily: MF.semibold, fontSize: 14, color: MC.text },
  deviceState: { fontFamily: MF.regular, fontSize: 11, color: MC.textTertiary, marginTop: 2 },
  connectBtn: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: MR.pill,
    borderWidth: 1, borderColor: 'rgba(120,61,236,0.60)', backgroundColor: 'rgba(120,61,236,0.10)',
  },
  connectText: { fontFamily: MF.semibold, fontSize: 11, color: MC.text },

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
  permRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  permLabel: { fontFamily: MF.regular, fontSize: 11, color: MC.textSecondary },
  permState: { fontFamily: MF.regular, fontSize: 11, color: MC.textTertiary },
  permNote: { fontFamily: MF.regular, fontSize: 9, color: MC.textTertiary },

  consentCard: { padding: 16, gap: 12 },
  consentHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  consentTitle: { fontFamily: MF.semibold, fontSize: 13, color: MC.text },
  toggle: {
    width: 40, height: 24, borderRadius: 12, padding: 2,
    backgroundColor: 'rgba(255,255,255,0.10)', justifyContent: 'center',
  },
  toggleOn: { backgroundColor: MC.violet },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: MC.white },
  knobOn: { alignSelf: 'flex-end' },
  consentBody: { fontFamily: MF.regular, fontSize: 11, color: MC.textSecondary, lineHeight: 17 },
  consentFine: {
    padding: 10, borderRadius: MR.sm,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  consentFineText: { fontFamily: MF.regular, fontSize: 9, color: MC.textTertiary, lineHeight: 14 },

  legal: {
    textAlign: 'center', fontFamily: MF.regular, fontSize: 9,
    color: MC.textTertiary, paddingHorizontal: 8, paddingTop: 16, lineHeight: 14,
  },
});
