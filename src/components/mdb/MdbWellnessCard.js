/**
 * The 5-factor wellness survey card from screens 05 / 06 (PRD A.5).
 *
 * Five rows of 1–5 dots, 16px, hollow with a #8E828D hairline until selected,
 * then filled with the violet→cyan gradient. Every tap saves immediately — there
 * is no submit button — and the footer states the 1 (Low) / 5 (Great) anchors.
 * Shown once per member-local day, on the first completed workout.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { MC, MG, MF, MR } from '../../theme/mdbKit';
import { patchWellness } from '../../services/workoutService';

const FACTORS = [
  { field: 'sleep_quality', key: 'sleepQuality', label: 'Sleep quality' },
  { field: 'soreness', key: 'soreness', label: 'Soreness' },
  { field: 'stress', key: 'stress', label: 'Stress' },
  { field: 'mood', key: 'mood', label: 'Mood' },
  { field: 'energy', key: 'energy', label: 'Energy' },
];

export default function MdbWellnessCard({ date, sessionId, initial, note = '1 per day', style }) {
  const [values, setValues] = useState(() => {
    const v = {};
    for (const f of FACTORS) v[f.field] = initial?.[f.key] ?? null;
    return v;
  });
  const [saving, setSaving] = useState(null);

  const select = async (field, value) => {
    const previous = values[field];
    setValues((prev) => ({ ...prev, [field]: value }));
    setSaving(field);
    try {
      await patchWellness({ field, value, date, sessionId });
    } catch {
      setValues((prev) => ({ ...prev, [field]: previous })); // revert on failure
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={[s.card, style]}>
      <View style={s.head}>
        <Text style={s.title}>How are you feeling?</Text>
        <Text style={s.note}>{note}</Text>
      </View>

      <View style={s.rows}>
        {FACTORS.map((f) => (
          <View key={f.field} style={s.row}>
            <Text style={s.label}>{f.label}</Text>
            <View style={s.dots}>
              {[1, 2, 3, 4, 5].map((n) => {
                const active = values[f.field] === n;
                return (
                  <TouchableOpacity
                    key={n}
                    onPress={() => select(f.field, n)}
                    disabled={saving === f.field}
                    activeOpacity={0.7}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`${f.label} ${n} of 5`}
                  >
                    {active ? (
                      <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.dot} />
                    ) : (
                      <View style={[s.dot, s.dotEmpty]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </View>

      <View style={s.foot}>
        <Text style={s.footHint}>Optional — tap any to save</Text>
        <View style={s.footAnchors}>
          <Text style={s.footAnchor}>1 (Low)</Text>
          <Text style={s.footAnchor}>5 (Great)</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: MC.card,
    borderWidth: 1,
    borderColor: MC.cardBorder,
    borderRadius: MR.card,
    padding: 16,
    gap: 14,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: MF.medium, fontSize: 14, color: MC.text },
  note: { fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary },

  rows: { gap: 12, paddingTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: MF.regular, fontSize: 12, color: MC.textSecondary },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  dotEmpty: { borderWidth: 1, borderColor: MC.textTertiary },

  foot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
  },
  footHint: { fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary },
  footAnchors: { flexDirection: 'row', gap: 32, paddingRight: 4 },
  footAnchor: {
    fontFamily: MF.regular, fontSize: 9, color: MC.textTertiary,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
});
