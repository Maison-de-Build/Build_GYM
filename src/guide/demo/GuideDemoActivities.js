/**
 * Demo: the activities list — a copy of the real Activities screen.
 *
 * Same header, same MY BOOKINGS button, same category pills, and the same large
 * cover-photo cards with their slot badge, duration, coin price and BOOK NOW
 * button, using the same photos bundled into the app. The point of the practice
 * run is that the member recognises the real screen the first time they open
 * it, so this one is laid out from ActivitiesScreen's own styles.
 *
 * The pills are drawn but not taught: activities have no category column yet,
 * so only "All" returns anything in the real app.
 */
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import { COLORS, FONTS } from '../../theme';
import GradientIcon from '../../components/GradientIcon';
import DemoScaffold from './DemoScaffold';
import GuideTarget from '../GuideTarget';
import { T } from '../targets';
import { DEMO_BANNER } from '../copy';
import { DEMO_ACTIVITIES } from './demoData';
import { DEMO_COVERS } from './demoImages';
import { useDemoBooking } from './demoBookingState';
import { useGuide } from '../GuideProvider';

const CATEGORIES = ['All', 'Cardio', 'Recovery', 'Sport'];

// The real screen's availability colours, copied so the badges match.
const badgeStyle = (n) => {
  if (n <= 0) return { bg: '#C62828', text: '#FFFFFF' };
  if (n === 1) return { bg: '#FF6D00', text: '#FFFFFF' };
  if (n === 2) return { bg: '#FFA000', text: '#151215' };
  if (n <= 4) return { bg: '#7C3AED', text: '#FFFFFF' };
  return { bg: '#00BCD4', text: '#151215' };
};

export default function GuideDemoActivities() {
  const balance = useDemoBooking((s) => s.balance);
  const pickActivity = useDemoBooking((s) => s.pickActivity);
  const { advance } = useGuide();

  return (
    <DemoScaffold label={DEMO_BANNER.booking}>
      <View style={s.headerRow}>
        <View style={s.backBtn}><GradientIcon name="arrow-back" set="ionicons" size={24} /></View>
        <Text style={s.headerTitle}>ACTIVITIES</Text>
        <View style={s.balanceWrap}>
          <Text style={s.balanceText}>{balance.toLocaleString('en-IN')}</Text>
          <MaterialIcons name="monetization-on" size={16} color="#F59E0B" />
        </View>
      </View>

      <View style={s.headerRow2}>
        <View style={s.bookingsBtn}><Text style={s.bookingsBtnText}>MY BOOKINGS</Text></View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.pillsScroll}
        contentContainerStyle={s.pillsRow}
      >
        {CATEGORIES.map((c, i) => (
          <View key={c} style={[s.pill, i === 0 && s.pillActive]}>
            {i === 0 && (
              <LinearGradient
                colors={['#7C3AED', '#00BCD4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
              />
            )}
            <Text style={[s.pillText, i === 0 && s.pillTextActive]}>{c.toUpperCase()}</Text>
          </View>
        ))}
      </ScrollView>

      <ScrollView style={s.cardsScroll} contentContainerStyle={s.cardsWrap} showsVerticalScrollIndicator={false}>
        {DEMO_ACTIVITIES.map((a, i) => {
          const badge = badgeStyle(a.slots);
          const card = (
            <TouchableOpacity style={s.card} onPress={() => { pickActivity(a); advance(T.DB_CARD); }} activeOpacity={0.9}>
              <View style={s.cover}>
                <Image source={DEMO_COVERS[a.name]} style={[StyleSheet.absoluteFill, s.coverImage]} resizeMode="cover" />
                <LinearGradient colors={['transparent', 'transparent', '#0D0D0F']} style={StyleSheet.absoluteFill} />
                <View style={[s.slotBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[s.slotBadgeText, { color: badge.text }]}>
                    {`${a.slots} SLOT${a.slots === 1 ? '' : 'S'}`}
                  </Text>
                </View>
                <View style={s.coverBottom}>
                  <Text style={s.coverName} numberOfLines={1}>{a.name}</Text>
                  <Text style={s.coverNext}>Next: {a.nextSlot}</Text>
                </View>
              </View>

              <View style={s.cardBody}>
                <View style={s.metaRow}>
                  <View style={s.metaChip}>
                    <MaterialIcons name="schedule" size={15} color="#FFA9FA" />
                    <Text style={s.metaItem}>{a.durationMinutes}m</Text>
                  </View>
                  <View style={s.metaDot} />
                  <View style={s.metaChip}>
                    <MaterialIcons name="monetization-on" size={15} color="#FFD700" />
                    <Text style={s.metaCost}>{a.coinPrice}</Text>
                  </View>
                </View>
                <LinearGradient
                  colors={['#7C3AED', '#00BCD4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.bookBtn}
                >
                  <Text style={s.bookBtnText}>BOOK NOW</Text>
                  <Ionicons name="arrow-forward" size={15} color={COLORS.white} />
                </LinearGradient>
              </View>

              <LinearGradient
                colors={['transparent', 'rgba(127,41,130,0.5)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.cardGlowLine}
              />
            </TouchableOpacity>
          );
          // The guide points at the first card.
          return i === 0
            ? <GuideTarget key={a.id} id={T.DB_CARD}>{card}</GuideTarget>
            : <View key={a.id}>{card}</View>;
        })}
        <View style={{ height: 24 }} />
      </ScrollView>
    </DemoScaffold>
  );
}

// Copied from ActivitiesScreen, with the header's status-bar padding removed —
// the practice banner already sits in that space.
const s = StyleSheet.create({
  headerRow: {
    justifyContent: 'center', alignItems: 'center',
    paddingTop: 14, paddingBottom: 6, paddingHorizontal: 20,
  },
  headerTitle: {
    fontFamily: FONTS.headline, fontSize: 18, color: COLORS.white,
    letterSpacing: 2, textTransform: 'uppercase',
  },
  backBtn: {
    position: 'absolute', left: 20, top: 12,
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  balanceWrap: {
    position: 'absolute', right: 20, top: 16,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  balanceText: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.white },

  headerRow2: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10,
  },
  bookingsBtn: {
    borderWidth: 1, borderColor: '#7F2982', borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 6,
  },
  bookingsBtnText: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.white, letterSpacing: 1.5 },

  pillsScroll: { flexGrow: 0, flexShrink: 0 },
  pillsRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12, gap: 8 },
  pill: {
    height: 34, paddingHorizontal: 20, borderRadius: 999, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  pillActive: { borderColor: 'transparent' },
  pillText: {
    fontFamily: FONTS.label, fontSize: 11, lineHeight: 16, color: '#D4C1CF',
    letterSpacing: 1.2, textAlignVertical: 'center', includeFontPadding: false,
  },
  pillTextActive: { color: '#0D0D0F', fontFamily: FONTS.bodyBold },

  cardsScroll: { flex: 1 },
  cardsWrap: { paddingHorizontal: 16, paddingTop: 10 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: 12,
  },
  cardGlowLine: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, opacity: 0.5 },

  cover: { height: 192, position: 'relative' },
  coverImage: { opacity: 0.80 },
  coverBottom: {
    position: 'absolute', left: 16, right: 16, bottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  coverName: {
    flex: 1, fontFamily: FONTS.display, fontSize: 30, color: COLORS.white,
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  coverNext: {
    fontFamily: FONTS.label, fontSize: 10, color: '#D4C1CF',
    letterSpacing: 1, marginLeft: 8, marginBottom: 4, textTransform: 'uppercase',
  },

  slotBadge: {
    position: 'absolute', top: 16, right: 16,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4,
  },
  slotBadgeText: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },

  cardBody: { backgroundColor: '#0D0D0F', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaItem: { fontFamily: FONTS.label, fontSize: 11, color: COLORS.white, letterSpacing: 1, textTransform: 'uppercase' },
  metaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  metaCost: { fontFamily: FONTS.bodyBold, fontSize: 14, color: '#FFD700', letterSpacing: 0.5 },

  bookBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 10,
  },
  bookBtnText: { fontFamily: FONTS.label, fontSize: 11, color: COLORS.white, letterSpacing: 2, textTransform: 'uppercase' },
});
