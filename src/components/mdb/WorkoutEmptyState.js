/**
 * WorkoutEmptyState — the "nothing scheduled" card shared by Home's TODAY'S
 * WORKOUT section and both calendar screens (01 PT, 02 freestyle).
 *
 * Two variants, matching what the pack always showed in two different places
 * before this was extracted:
 *   pt         — flat "Rest day" card, never actionable (a coach assigns).
 *   freestyle  — taller invitation card with the gradient "+"; when the day
 *                can't be scheduled (a past date), the "+" is replaced by a
 *                stated reason rather than a dead button.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { MC, MG, MF } from '../../theme/mdbKit';
import MdbIcon from './MdbIcon';
import GlowBlob from './GlowBlob';
import { LuxuryCard } from './MdbPrimitives';

export default function WorkoutEmptyState({
  variant = 'freestyle', onAdd, canAdd = true, pastLabel,
}) {
  if (variant === 'pt') {
    return (
      <LuxuryCard style={s.restCard}>
        <Text style={s.restTitle}>Rest day</Text>
        <Text style={s.restSub}>{pastLabel || 'No workout assigned for today.'}</Text>
      </LuxuryCard>
    );
  }

  return (
    <LuxuryCard style={s.emptyCard}>
      <GlowBlob size={144} color={MC.violet} opacity={0.08} style={s.emptyGlow} />
      <Text style={s.emptyText}>No workout scheduled</Text>
      {canAdd ? (
        <>
          <TouchableOpacity onPress={onAdd} activeOpacity={0.85} style={s.plusShadow}>
            <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.plusBtn}>
              <MdbIcon name="plus" size={20} color={MC.white} />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={s.emptyHint}>Browse templates</Text>
        </>
      ) : (
        // A past day cannot be scheduled — self-assign only accepts
        // today..+14 — so the "+" is absent rather than dead.
        <Text style={s.emptyHint}>{pastLabel || 'Past day — nothing was logged'}</Text>
      )}
    </LuxuryCard>
  );
}

const s = StyleSheet.create({
  restCard: { padding: 20, alignItems: 'center' },
  restTitle: { fontFamily: MF.semibold, fontSize: 16, color: MC.text },
  restSub: { fontFamily: MF.regular, fontSize: 12, color: MC.textTertiary, marginTop: 4 },

  emptyCard: { height: 190, padding: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  emptyGlow: { position: 'absolute' },
  emptyText: {
    fontFamily: MF.medium, fontSize: 14, color: MC.textSecondary,
    marginBottom: 16, letterSpacing: -0.2,
  },
  plusShadow: {
    shadowColor: MC.violet, shadowOpacity: 0.5,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  plusBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  emptyHint: { fontFamily: MF.medium, fontSize: 11, color: MC.textTertiary, letterSpacing: 0.4, marginTop: 12 },
});
