/**
 * Demo: booking confirmed.
 *
 * Always carries "View my bookings", which is also how the guide reaches the
 * bookings screen — My Bookings is not on Home, so pointing at it here and in
 * the Activities header is pointing at where it actually lives.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { COLORS, FONTS } from '../../theme';
import DemoScaffold from './DemoScaffold';
import GuideTarget from '../GuideTarget';
import { T } from '../targets';
import { DEMO_BANNER } from '../copy';
import { useDemoBooking } from './demoBookingState';
import { useGuide } from '../GuideProvider';

export default function GuideDemoBookingSuccess() {
  const { activity, balance, booked, confirm } = useDemoBooking();
  const { advance } = useGuide();

  // Reaching this screen means the booking happened. Book Now confirms before
  // the guide moves here; this is the backstop for any other way in, so the
  // screen never claims coins came off a balance that never moved.
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

        {/* The gap above the button lives on the wrapper, not the button, so the
            highlight hugs the button instead of taking in the space above it. */}
        <GuideTarget id={T.DB_VIEW_BOOKINGS} style={s.btnGap}>
          <TouchableOpacity
            style={s.btn}
            onPress={() => advance(T.DB_VIEW_BOOKINGS)}
            activeOpacity={0.85}
          >
            <Text style={s.btnText}>VIEW MY BOOKINGS</Text>
          </TouchableOpacity>
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
  btnGap: { marginTop: 24 },
  btn: {
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.primaryLight,
  },
  btnText: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.primaryLight, letterSpacing: 1.5 },
});
