/**
 * Demo: My Bookings, with the practice booking on it.
 *
 * The card carries a Practice tag and neither Cancel nor Reschedule: there is
 * nothing real to cancel, and offering the control would teach a member to
 * expect a confirmation that never comes.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

import { COLORS, FONTS } from '../../theme';
import DemoScaffold from './DemoScaffold';
import GuideTarget from '../GuideTarget';
import { T } from '../targets';
import { DEMO_BANNER } from '../copy';
import { demoDates, DEMO_SLOTS } from './demoData';
import { useDemoBooking } from './demoBookingState';

export default function GuideDemoMyBookings() {
  const { activity, dateIso, slotId } = useDemoBooking();
  const date = demoDates().find((d) => d.iso === dateIso);
  const slot = DEMO_SLOTS.find((s2) => s2.id === slotId);

  return (
    <DemoScaffold label={DEMO_BANNER.booking}>
      <View style={s.header}><Text style={s.title}>MY BOOKINGS</Text></View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <GuideTarget id={T.DB_BOOKING_CARD}>
          <View style={s.card}>
            <View style={s.cardTop}>
              <View style={s.badge}><Text style={s.badgeText}>UPCOMING</Text></View>
              <View style={s.tag}><Text style={s.tagText}>PRACTICE</Text></View>
            </View>
            <Text style={s.name}>{activity?.name}</Text>
            <Text style={s.when}>
              {date?.label}{slot ? ` · ${slot.label}` : ''}
            </Text>
            <Text style={s.cost}>₿ {activity?.coinPrice} · {activity?.durationMinutes} min</Text>
          </View>
        </GuideTarget>

        <View style={s.next}>
          <Text style={s.nextText}>See it in your coin history</Text>
        </View>
      </ScrollView>
    </DemoScaffold>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontFamily: FONTS.headline, fontSize: 16, color: COLORS.textPrimary, letterSpacing: 4 },
  scroll: { padding: 20, gap: 16 },
  card: { backgroundColor: '#1A1A2E', borderRadius: 14, padding: 16, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: 'rgba(124,58,237,0.2)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)',
  },
  badgeText: { fontFamily: FONTS.label, fontSize: 9, color: '#A78BFA', letterSpacing: 1 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(120,61,236,0.25)' },
  tagText: { fontFamily: FONTS.label, fontSize: 9, color: '#C4B5FD', letterSpacing: 1 },
  name: { fontFamily: FONTS.bodyBold, fontSize: 16, color: COLORS.white, marginTop: 4 },
  when: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted },
  cost: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.primaryLight, marginTop: 2 },

  next: { alignItems: 'center', paddingVertical: 14 },
  nextText: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.primaryLight },
});
