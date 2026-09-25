/**
 * Demo: the workout summary.
 *
 * The 2×2 stat grid and the share row, matching the real receipt. Pressing the
 * share row ends the guide and shares nothing: the real one opens a
 * card-capture screen and then the OS share sheet, and a practice run must not
 * put anything in front of the member's contacts.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

import { MC, MF, MR, MS } from '../../theme/mdbKit';
import DemoScaffold from './DemoScaffold';
import GuideTarget from '../GuideTarget';
import { T } from '../targets';
import { DEMO_BANNER } from '../copy';
import { DEMO_SUMMARY } from './demoData';
import { useGuide } from '../GuideProvider';

export default function GuideDemoSummary() {
  const { advance } = useGuide();
  return (
    <DemoScaffold label={DEMO_BANNER.workout}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <Text style={s.eyebrow}>SESSION COMPLETE</Text>
          <Text style={s.title}>{DEMO_SUMMARY.name}</Text>
          <Text style={s.date}>Today</Text>
        </View>

        <GuideTarget id={T.DW_SUMMARY_STATS}>
          <View style={s.statCard}>
            <View style={s.statRow}>
              <Cell value={DEMO_SUMMARY.durationMinutes} unit="min" label="DURATION" divider />
              <Cell value={DEMO_SUMMARY.totalVolume.toLocaleString()} unit="kg" label="TOTAL VOLUME" />
            </View>
            <View style={[s.statRow, s.statRowTop]}>
              <Cell
                value={DEMO_SUMMARY.setsCompleted}
                unit={`/ ${DEMO_SUMMARY.setsTarget}`}
                label="SETS COMPLETED"
                divider
              />
              <Cell value={DEMO_SUMMARY.exercises} label="EXERCISES" />
            </View>
          </View>
        </GuideTarget>

        <GuideTarget id={T.DW_SUMMARY_SHARE}>
          {/* Pressing it finishes the guide. It never opens the share sheet. */}
          <TouchableOpacity
            style={s.shareRow}
            onPress={() => advance(T.DW_SUMMARY_SHARE)}
            activeOpacity={0.85}
          >
            <Text style={s.shareText}>Share session card</Text>
            <Text style={s.shareArrow}>↗</Text>
          </TouchableOpacity>
        </GuideTarget>
      </ScrollView>
    </DemoScaffold>
  );
}

function Cell({ value, unit, label, divider }) {
  return (
    <View style={[s.cell, divider && s.cellDivider]}>
      <Text style={s.value}>
        {value}
        {!!unit && <Text style={s.unit}> {unit}</Text>}
      </Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { padding: MS.hMargin, paddingTop: 28, gap: 20 },
  hero: { alignItems: 'center', gap: 4 },
  eyebrow: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1.6,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  title: { fontFamily: MF.semibold, fontSize: 22, color: MC.text, letterSpacing: -0.3 },
  date: { fontFamily: MF.regular, fontSize: 12, color: MC.textTertiary },

  statCard: {
    backgroundColor: MC.card, borderRadius: MR.card,
    borderWidth: 1, borderColor: MC.cardBorder, paddingVertical: 8,
  },
  statRow: { flexDirection: 'row' },
  statRowTop: { borderTopWidth: 1, borderTopColor: MC.cardBorder },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 18, gap: 4 },
  cellDivider: { borderRightWidth: 1, borderRightColor: MC.cardBorder },
  value: { fontFamily: MF.semibold, fontSize: 30, color: MC.text, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: MF.medium, fontSize: 13, color: MC.textTertiary },
  label: {
    fontFamily: MF.medium, fontSize: 9, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
  },

  shareRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: MR.card,
    backgroundColor: MC.cardAlt, borderWidth: 1, borderColor: MC.cardBorder,
  },
  shareText: { fontFamily: MF.medium, fontSize: 14, color: MC.text },
  shareArrow: { fontFamily: MF.medium, fontSize: 16, color: MC.violetLight },
});
