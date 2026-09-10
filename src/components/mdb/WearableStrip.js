/**
 * The 44pt live tracker strip from screen 03.
 *
 * ⚠️ WEARABLES ARE NOT BUILT YET (PRD Part C). `/member/dashboard` returns
 * wearableState: 'none' and no HR / calorie source exists. Per the build
 * instruction this ships laid out exactly as designed, with the pack's
 * placeholder readings and a DEMO marker so it is never mistaken for live data,
 * and with no interaction. The elapsed-time mirror on the right IS real.
 *
 * When Part C lands: delete DEMO_HR/DEMO_KCAL, take the values from the session
 * payload, drop the marker, and hide the strip when wearableState === 'none'.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { MC, MF, MR } from '../../theme/mdbKit';
import MdbIcon from './MdbIcon';

const DEMO_HR = 142;
const DEMO_HR_AGE = '12s ago';
const DEMO_KCAL = 286;

export default function WearableStrip({ elapsedSeconds = 0, live = false, hr, kcal, hrAge }) {
  const shownHr = live ? hr : DEMO_HR;
  const shownKcal = live ? kcal : DEMO_KCAL;
  const shownAge = live ? hrAge : DEMO_HR_AGE;
  const minutes = Math.floor(elapsedSeconds / 60);

  return (
    <View style={s.strip} pointerEvents="none">
      <View style={s.block}>
        <MdbIcon name="heart-solid" size={14} color="#EF4444" />
        <Text style={s.value}>{shownHr}</Text>
        <Text style={s.unit}>bpm</Text>
        <Text style={s.age}>{shownAge}</Text>
      </View>

      <View style={s.block}>
        <MdbIcon name="flame" size={14} color={MC.warm} />
        <Text style={s.value}>{shownKcal}</Text>
        <Text style={s.unit}>kcal</Text>
      </View>

      <View style={s.blockRight}>
        <MdbIcon name="clock" size={12} color={MC.textTertiary} />
        <Text style={s.duration}>{minutes}m</Text>
      </View>

      {!live && (
        <View style={s.demoBadge}>
          <Text style={s.demoText}>DEMO</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  strip: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: 1,
    borderBottomColor: MC.cardBorder,
  },
  block: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  blockRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  value: {
    fontFamily: MF.monoSemi, fontSize: 13, color: MC.text,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontFamily: MF.regular, fontSize: 11, color: MC.textSecondary },
  age: { fontFamily: MF.regular, fontSize: 9, color: MC.textTertiary, marginLeft: 2 },
  duration: {
    fontFamily: MF.mono, fontSize: 11, color: MC.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  demoBadge: {
    position: 'absolute', right: 4, top: 2,
    paddingHorizontal: 4, borderRadius: MR.xs,
    backgroundColor: 'rgba(245,166,35,0.12)',
  },
  demoText: { fontFamily: MF.semibold, fontSize: 7, letterSpacing: 0.8, color: MC.warm },
});
