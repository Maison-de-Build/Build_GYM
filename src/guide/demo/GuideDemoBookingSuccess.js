/**
 * Demo: booking confirmed.
 *
 * Always carries "View my bookings", which is also how the guide reaches the
 * bookings screen — My Bookings is not on Home, so pointing at it here and in
 * the Activities header is pointing at where it actually lives.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { COLORS, FONTS } from '../../theme';
import DemoScaffold from './DemoScaffold';
import GuideTarget from '../GuideTarget';
import { T } from '../targets';
import { DEMO_BANNER } from '../copy';
import { useDemoBooking } from './demoBookingState';

export default function GuideDemoBookingSuccess() {
  const { activity, balance, booked, confirm } = useDemoBooking();

  // Reaching this screen means the booking happened, whether the member tapped
  // the highlighted Book button or moved on with Next. Without this the success
  // screen would claim coins came off a balance that never moved.
  useEffect(() => { if (!booked) confirm(); }, [booked, confirm]);

  return (
    <DemoScaffold label={DEMO_BANNER.booking}>
      <View style={s.body}>
        <View style={s.tickCircle}>
          <MaterialIcons name="check" size={40} color={COLORS.white} />
        </View>
        <Text style={s.title}>Booked</Text>
        <Text style={s.sub}>
          ₿ {activity?.coinPrice ?? 0} came off your balance. Here&#39;s where your booking lives.
        </Text>
        <Text style={s.balance}>Practice balance: ₿ {balance}</Text>

        <GuideTarget id={T.DB_VIEW_BOOKINGS}>
          <View style={s.btn}>
            <Text style={s.btnText}>VIEW MY BOOKINGS</Text>
          </View>
        </GuideTarget>
      </View>
    </DemoScaffold>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  tickCircle: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(76,175,80,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  title: { fontFamily: FONTS.headline, fontSize: 24, color: COLORS.white },
  sub: {
    fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted,
    textAlign: 'center', lineHeight: 20,
  },
  balance: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.primaryLight, marginTop: 4 },
  btn: {
    marginTop: 24, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.primaryLight,
  },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.primaryLight, letterSpacing: 1.5 },
});
