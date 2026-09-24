/**
 * Demo: the activities list.
 *
 * No category filter. The real screen shows All / Cardio / Recovery / Sport
 * pills, but `activities` has no category column, so only "All" ever returns
 * anything — teaching that filter would teach a control that does nothing.
 * The five activities are real rows copied from the live table.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import { COLORS, FONTS } from '../../theme';
import DemoScaffold from './DemoScaffold';
import GuideTarget from '../GuideTarget';
import { T } from '../targets';
import { DEMO_BANNER } from '../copy';
import { DEMO_ACTIVITIES } from './demoData';
import { useDemoBooking } from './demoBookingState';

// Matches the icon/colour fallbacks the real Activities screen uses, so the
// practice list looks like the one the member will come back to.
const STYLE = {
  Yoga: { icon: 'body-outline', color: ['#7C3AED', '#4C1D95'] },
  HIIT: { icon: 'flash-outline', color: ['#D97706', '#78350F'] },
  Cycling: { icon: 'bicycle-outline', color: ['#2563EB', '#1E3A8A'] },
  Pickleball: { icon: 'tennisball-outline', color: ['#16A34A', '#14532D'] },
  'Sauna & Steam': { icon: 'flame-outline', color: ['#B45309', '#451A03'] },
};
const FALLBACK = { icon: 'barbell-outline', color: ['#6B7280', '#374151'] };

export default function GuideDemoActivities() {
  const balance = useDemoBooking((s) => s.balance);
  const pickActivity = useDemoBooking((s) => s.pickActivity);

  // Records the pick only. The guide moves the screen on when its step says
  // so, so a tap can never get ahead of the tooltip the member is reading.
  const open = (activity) => pickActivity(activity);

  return (
    <DemoScaffold label={DEMO_BANNER.booking}>
      <View style={s.header}>
        <Text style={s.title}>ACTIVITIES</Text>
        <View style={s.balance}>
          <Text style={s.balanceText}>{balance.toLocaleString('en-IN')}</Text>
          <MaterialIcons name="monetization-on" size={16} color="#F59E0B" />
          <View style={s.tag}><Text style={s.tagText}>PRACTICE</Text></View>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <GuideTarget id={T.DB_LIST}>
          <View style={{ gap: 12 }}>
            {DEMO_ACTIVITIES.map((a, i) => {
              const st = STYLE[a.name] || FALLBACK;
              const card = (
                <TouchableOpacity style={s.card} onPress={() => open(a)} activeOpacity={0.85}>
                  <LinearGradient colors={st.color} style={s.thumb}>
                    <Ionicons name={st.icon} size={26} color={COLORS.white} />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{a.name}</Text>
                    <Text style={s.cardMeta}>{a.durationMinutes} min</Text>
                  </View>
                  <Text style={s.price}>₿ {a.coinPrice}</Text>
                </TouchableOpacity>
              );
              // The guide points at the first card, so only that one is a target.
              return i === 0
                ? <GuideTarget key={a.id} id={T.DB_CARD}>{card}</GuideTarget>
                : <View key={a.id}>{card}</View>;
            })}
          </View>
        </GuideTarget>
      </ScrollView>
    </DemoScaffold>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  title: {
    fontFamily: FONTS.headline, fontSize: 16, color: COLORS.textPrimary, letterSpacing: 4,
  },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  balanceText: {
    fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.white,
    fontVariant: ['tabular-nums'],
  },
  tag: {
    marginLeft: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'rgba(120,61,236,0.25)',
  },
  tagText: { fontFamily: FONTS.label, fontSize: 8, color: '#C4B5FD', letterSpacing: 1 },

  scroll: { paddingHorizontal: 20, paddingBottom: 24 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1A1A2E', borderRadius: 14, padding: 14,
  },
  thumb: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: FONTS.bodyBold, fontSize: 15, color: COLORS.white },
  cardMeta: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  price: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.primaryLight },
});
