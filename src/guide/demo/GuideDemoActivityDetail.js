/**
 * Demo: the activity detail, where the practice booking is made.
 *
 * Dates, slots and a Book button, matching the real screen — which has no
 * confirm step, so this doesn't either: one tap books, exactly as it will for
 * real. The dates are tomorrow onwards, never today, so no slot on the list has
 * already passed.
 *
 * Booking here deducts from the practice balance in memory. There is no API
 * client on this screen to call even by accident.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS, FONTS } from '../../theme';
import DemoScaffold from './DemoScaffold';
import GuideTarget from '../GuideTarget';
import { T } from '../targets';
import { DEMO_BANNER } from '../copy';
import { demoDates, DEMO_SLOTS } from './demoData';
import { useDemoBooking } from './demoBookingState';
import { useGuide } from '../GuideProvider';

export default function GuideDemoActivityDetail() {
  const { activity, dateIso, slotId, balance, pickDate, pickSlot, confirm } = useDemoBooking();
  const dates = useMemo(() => demoDates(), []);
  const { advance } = useGuide();

  if (!activity) return <DemoScaffold label={DEMO_BANNER.booking}><View /></DemoScaffold>;

  // Deducts from the practice balance held in memory, then tells the guide the
  // button was pressed; the guide handles the move to the success screen.
  const book = () => { confirm(); advance(T.DB_BOOK); };

  return (
    <DemoScaffold label={DEMO_BANNER.booking}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <GuideTarget id={T.DB_PRICE}>
          <View style={s.summary}>
            <View style={s.col}>
              <Text style={s.key}>ACTIVITY</Text>
              <Text style={s.val} numberOfLines={1}>{activity.name}</Text>
            </View>
            <View style={[s.col, { alignItems: 'center' }]}>
              <Text style={s.key}>DURATION</Text>
              <Text style={s.val}>{activity.durationMinutes} min</Text>
            </View>
            <View style={[s.col, { alignItems: 'flex-end' }]}>
              <Text style={s.key}>COST</Text>
              <Text style={[s.val, { color: COLORS.primaryLight }]}>₿ {activity.coinPrice}</Text>
            </View>
          </View>
        </GuideTarget>

        <Text style={s.desc}>{activity.description}</Text>

        <Text style={s.section}>SELECT DATE</Text>
        <GuideTarget id={T.DB_DATE}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            {dates.map((d) => {
              const on = dateIso === d.iso;
              return (
                <TouchableOpacity
                  key={d.iso}
                  style={[s.dateChip, on && s.chipOn]}
                  onPress={() => { pickDate(d.iso); advance(T.DB_DATE); }}
                  activeOpacity={0.85}
                >
                  <Text style={[s.dateDow, on && s.chipTextOn]}>{d.dow}</Text>
                  <Text style={[s.dateNum, on && s.chipTextOn]}>{d.day}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </GuideTarget>

        <Text style={s.section}>SELECT TIME</Text>
        <GuideTarget id={T.DB_SLOT}>
          <View style={s.slotGrid}>
            {DEMO_SLOTS.map((slot) => {
              const on = slotId === slot.id;
              return (
                <TouchableOpacity
                  key={slot.id}
                  style={[s.slot, on && s.chipOn]}
                  onPress={() => { pickSlot(slot.id); advance(T.DB_SLOT); }}
                  activeOpacity={0.85}
                >
                  <Text style={[s.slotText, on && s.chipTextOn]}>{slot.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </GuideTarget>

        <View style={s.balanceRow}>
          <Text style={s.balanceLabel}>Practice balance after booking</Text>
          <Text style={s.balanceVal}>₿ {balance - activity.coinPrice}</Text>
        </View>
      </ScrollView>

      <View style={s.bottomBar}>
        <GuideTarget id={T.DB_BOOK}>
          <TouchableOpacity onPress={book} activeOpacity={0.9}>
            <LinearGradient
              colors={[COLORS.primary, '#923a93']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.cta}
            >
              <Text style={s.ctaText}>BOOK NOW</Text>
            </LinearGradient>
          </TouchableOpacity>
        </GuideTarget>
      </View>
    </DemoScaffold>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 24 },
  summary: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  col: { flex: 1 },
  key: { fontFamily: FONTS.label, fontSize: 9, color: COLORS.textMuted, letterSpacing: 1.4 },
  val: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.white, marginTop: 4 },
  desc: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, lineHeight: 19, marginTop: 16 },

  section: {
    fontFamily: FONTS.label, fontSize: 10, color: COLORS.textMuted,
    letterSpacing: 1.5, marginTop: 24, marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', gap: 10 },
  dateChip: {
    width: 58, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: 'transparent',
  },
  dateDow: { fontFamily: FONTS.label, fontSize: 9, color: COLORS.textMuted, letterSpacing: 1 },
  dateNum: { fontFamily: FONTS.bodyBold, fontSize: 16, color: COLORS.white, marginTop: 2 },
  chipOn: { backgroundColor: 'rgba(127,41,130,0.35)', borderColor: COLORS.primaryLight },
  chipTextOn: { color: COLORS.white },

  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: 'transparent',
  },
  slotText: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.textMuted },

  balanceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 28, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  balanceLabel: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted },
  balanceVal: { fontFamily: FONTS.bodyBold, fontSize: 15, color: COLORS.primaryLight },

  bottomBar: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  cta: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.white, letterSpacing: 2 },
});
