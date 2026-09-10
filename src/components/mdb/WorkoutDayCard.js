/**
 * WorkoutDayCard — the "today's workout" card shared by screens 01 and 02.
 *
 * Title + program eyebrow, a coach chip (trainer-assigned only), four compact
 * stat blocks fenced by hairlines, and the dual-state CTA: violet→cyan gradient
 * "BEGIN WORKOUT" while assigned, flat #1A1A1E "COMPLETED" with an amber tick
 * once done.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { MC, MF, MR } from '../../theme/mdbKit';
import MdbIcon from './MdbIcon';
import GlowBlob from './GlowBlob';
import { LuxuryCard, PrimaryCta, CompletedCta } from './MdbPrimitives';
import {
  sequenceOf, estimatedMinutes, intensityLabel, focusLabel, initialsOf,
} from '../../utils/mdbWorkout';

export default function WorkoutDayCard({ workout, onBegin }) {
  const sequence = sequenceOf(workout);
  const est = estimatedMinutes(sequence);
  const intensity = intensityLabel(sequence);
  const focus = focusLabel(workout);
  const coach = workout?.trainerName || workout?.assignedByName || null;
  const isCompleted = workout?.status === 'completed' || workout?.status === 'partial';
  const inProgress = workout?.status === 'in_progress';

  return (
    <LuxuryCard style={s.card}>
      <GlowBlob size={112} style={s.glow} />

      <View style={s.head}>
        <View style={s.headText}>
          <Text style={s.title} numberOfLines={1}>{workout?.snapshot?.name || 'Workout'}</Text>
          <Text style={s.eyebrow}>
            {workout?.sourceTemplateName ? `PROGRAM • ${workout.sourceTemplateName}` : 'PROGRAM'}
          </Text>
        </View>

        {!!coach && (
          <View style={s.coachChip}>
            <View style={s.coachAvatar}>
              <Text style={s.coachInitials}>{initialsOf(coach)}</Text>
            </View>
            <Text style={s.coachName} numberOfLines={1}>{coach}</Text>
          </View>
        )}
      </View>

      <View style={s.statRow}>
        <Stat icon="list" tint={MC.cyan} value={String(sequence.length)} label="Exercises" />
        <Stat icon="clock" tint={MC.cyan} value={est != null ? `${est}m` : '—'} label="Est. Time" />
        <Stat icon="bolt" tint={MC.violet} value={intensity || '—'} label="Intensity" small />
        <Stat icon="target" tint={MC.warm} value={focus || '—'} label="Focus" small />
      </View>

      {isCompleted
        ? <CompletedCta onPress={onBegin} />
        : <PrimaryCta label={inProgress ? 'Resume Workout' : 'Begin Workout'} onPress={onBegin} />}
    </LuxuryCard>
  );
}

function Stat({ icon, tint, value, label, small }) {
  return (
    <View style={s.stat}>
      <MdbIcon name={icon} size={14} color={tint} />
      <Text style={[s.statValue, small && s.statValueSmall]} numberOfLines={1}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { padding: 16, overflow: 'hidden' },
  glow: { position: 'absolute', top: -40, right: -40 },

  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 14 },
  headText: { flex: 1, minWidth: 0 },
  title: { fontFamily: MF.semibold, fontSize: 18, color: MC.text, letterSpacing: -0.2 },
  eyebrow: {
    fontFamily: MF.medium, fontSize: 10, letterSpacing: 1.6,
    textTransform: 'uppercase', color: 'rgba(185,178,186,0.7)', marginTop: 2,
  },

  coachChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: MR.pill, paddingVertical: 4, paddingHorizontal: 8, maxWidth: 140,
  },
  coachAvatar: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: MC.violet, alignItems: 'center', justifyContent: 'center',
  },
  coachInitials: { fontFamily: MF.bold, fontSize: 9, color: MC.white, letterSpacing: -0.5 },
  coachName: { fontFamily: MF.medium, fontSize: 11, color: MC.textTertiary, flexShrink: 1 },

  statRow: {
    flexDirection: 'row', gap: 8, paddingVertical: 12, marginBottom: 16,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: MC.cardBorder,
  },
  stat: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statValue: {
    fontFamily: MF.semibold, fontSize: 13, color: MC.text,
    fontVariant: ['tabular-nums'], marginTop: 2,
  },
  statValueSmall: { fontSize: 11 },
  statLabel: {
    fontFamily: MF.medium, fontSize: 10, letterSpacing: 0.8,
    textTransform: 'uppercase', color: MC.textTertiary, marginTop: 1,
  },
});
