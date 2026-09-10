/**
 * ⚠️ INTERIM — needs a product decision.
 *
 * The handoff pack is a catalogue of 23 screens; it never defines a global
 * navigation for them. Insights (09), History (22), Nutrition (07), Progress
 * (17) and Recovery (20) therefore have no designed entry point — screen 23
 * links to Insights and Progress, and nothing links to the rest.
 *
 * Rather than invent an IA silently or ship unreachable screens, this renders a
 * plain link row at the foot of the calendar so every screen is reachable for
 * review. Replace it once the real navigation is agreed.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { MC, MF, MR } from '../../theme/mdbKit';

export default function MdbSecondaryNav({ navigation, showNutrition = false, style }) {
  const links = [
    { label: 'Insights', route: 'MdbAnalytics' },
    { label: 'History', route: 'MdbWorkoutHistory' },
    { label: 'Recovery', route: 'MdbMuscleRecovery' },
    { label: 'Progress', route: 'MdbProgressTracker' },
    ...(showNutrition ? [{ label: 'Nutrition', route: 'MdbNutrition' }] : []),
  ];

  return (
    <View style={[s.wrap, style]}>
      <Text style={s.note}>Interim navigation — pending IA decision</Text>
      <View style={s.row}>
        {links.map((l) => (
          <TouchableOpacity
            key={l.route}
            style={s.chip}
            onPress={() => navigation.navigate(l.route)}
            activeOpacity={0.8}
          >
            <Text style={s.chipText}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8, alignItems: 'center' },
  note: {
    fontFamily: MF.regular, fontSize: 9, letterSpacing: 0.6,
    textTransform: 'uppercase', color: 'rgba(142,130,141,0.6)',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: MR.button,
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder,
  },
  chipText: { fontFamily: MF.medium, fontSize: 11, color: MC.textSecondary },
});
