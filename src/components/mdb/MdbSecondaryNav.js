/**
 * The Training screen's gateway to everything that gives the training
 * meaning — Insights, Nutrition, Recovery, and below them History and
 * Progress.
 *
 * These screens shipped with no designed entry point at all, so they lived
 * behind a row of small grey chips at the very bottom of the calendar under
 * a caption that read "Interim navigation — pending IA decision". Members
 * effectively never found them. They now sit at the top of the Training
 * screen as real cards: the three that change how someone trains get full
 * treatment, the two reference surfaces get a compact row.
 *
 * Nutrition is PT-only — /nutrition/plan answers null for freestyle members
 * — so when it's hidden Recovery is promoted into the primary row rather
 * than leaving a gap.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { MC, MF, MR } from '../../theme/mdbKit';
import MdbIcon from './MdbIcon';

const INSIGHTS = {
  label: 'Insights', route: 'MdbAnalytics', icon: 'trending-up',
  tint: MC.violetLight, sub: 'Volume & PRs',
};
const NUTRITION = {
  label: 'Nutrition', route: 'MdbNutrition', icon: 'flame',
  tint: MC.cyan, sub: 'Your meal plan',
};
const RECOVERY = {
  label: 'Recovery', route: 'MdbMuscleRecovery', icon: 'heart',
  tint: MC.warm, sub: 'Muscle readiness',
};
const HISTORY = { label: 'History', route: 'MdbWorkoutHistory', icon: 'clock' };
const PROGRESS = { label: 'Progress', route: 'MdbProgressTracker', icon: 'camera' };

export default function MdbSecondaryNav({ navigation, showNutrition = false, style }) {
  const primary = showNutrition ? [INSIGHTS, NUTRITION, RECOVERY] : [INSIGHTS, RECOVERY];
  const secondary = [HISTORY, PROGRESS];

  const go = (route) => navigation.navigate(route);

  return (
    <View style={[s.wrap, style]}>
      <View style={s.primaryRow}>
        {primary.map((l) => (
          <TouchableOpacity
            key={l.route}
            style={s.card}
            onPress={() => go(l.route)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={l.label}
          >
            <View style={[s.iconCircle, { backgroundColor: `${l.tint}1F`, borderColor: `${l.tint}59` }]}>
              <MdbIcon name={l.icon} size={16} color={l.tint} />
            </View>
            <Text style={s.cardLabel}>{l.label}</Text>
            <Text style={s.cardSub} numberOfLines={1}>{l.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.secondaryRow}>
        {secondary.map((l) => (
          <TouchableOpacity
            key={l.route}
            style={s.chip}
            onPress={() => go(l.route)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={l.label}
          >
            <MdbIcon name={l.icon} size={12} color={MC.textTertiary} />
            <Text style={s.chipText}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8 },

  primaryRow: { flexDirection: 'row', gap: 8 },
  card: {
    flex: 1, alignItems: 'flex-start', gap: 6,
    paddingVertical: 12, paddingHorizontal: 12,
    backgroundColor: MC.card, borderRadius: MR.card,
    borderWidth: 1, borderColor: MC.cardBorder,
  },
  iconCircle: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  cardLabel: { fontFamily: MF.semibold, fontSize: 13, color: MC.text },
  cardSub: { fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary },

  secondaryRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: MR.button,
    backgroundColor: MC.cardAlt, borderWidth: 1, borderColor: MC.cardBorder,
  },
  chipText: { fontFamily: MF.medium, fontSize: 11, color: MC.textSecondary },
});
