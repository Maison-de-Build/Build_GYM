/**
 * Demo: the coin history, with the practice deduction on it.
 *
 * Last screen of the booking run. The row is tagged Practice for the same
 * reason the banner exists: a member looking at a debit needs to know it did
 * not happen.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

import { COLORS, FONTS } from '../../theme';
import DemoScaffold from './DemoScaffold';
import GuideTarget from '../GuideTarget';
import { T } from '../targets';
import { DEMO_BANNER } from '../copy';
import { useDemoBooking } from './demoBookingState';

export default function GuideDemoTransactions() {
  const { activity, balance } = useDemoBooking();

  return (
    <DemoScaffold label={DEMO_BANNER.booking}>
      <View style={s.header}>
        <Text style={s.title}>TRANSACTION HISTORY</Text>
      </View>

      <View style={s.balanceCard}>
        <Text style={s.balanceLabel}>PRACTICE BALANCE</Text>
        <Text style={s.balanceValue}>{balance.toLocaleString('en-IN')}</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <GuideTarget id={T.DB_TXN_ROW}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <View style={s.rowTop}>
                <Text style={s.rowTitle} numberOfLines={1}>{activity?.name}</Text>
                <View style={s.tag}><Text style={s.tagText}>PRACTICE</Text></View>
              </View>
              <Text style={s.rowDate}>Today</Text>
            </View>
            <Text style={s.debit}>− {activity?.coinPrice}</Text>
          </View>
        </GuideTarget>
      </ScrollView>
    </DemoScaffold>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontFamily: FONTS.headline, fontSize: 15, color: COLORS.textPrimary, letterSpacing: 3 },
  balanceCard: {
    marginHorizontal: 20, padding: 18, borderRadius: 16,
    backgroundColor: '#1C1917', borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)',
  },
  balanceLabel: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.textMuted, letterSpacing: 1.5 },
  balanceValue: {
    fontFamily: FONTS.headline, fontSize: 26, color: COLORS.white, marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  scroll: { padding: 20, gap: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1A1A2E', borderRadius: 12, padding: 16,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.white },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(120,61,236,0.25)' },
  tagText: { fontFamily: FONTS.label, fontSize: 8, color: '#C4B5FD', letterSpacing: 1 },
  rowDate: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted, marginTop: 3 },
  debit: { fontFamily: FONTS.bodyBold, fontSize: 15, color: '#F87171', fontVariant: ['tabular-nums'] },
});
