/**
 * AdhocExerciseRow — one exercise in the multi-select browser's "Exercises"
 * tab. Tap to select/deselect; a selected row expands in place with the
 * per-set target inputs the measurement type actually uses (Doc 4 §3.2.5).
 *
 * Ported from the trainer app's exercise picker
 * (BuildGymTrainer/src/screens/trainer/PlanExercisePickerScreen.tsx) —
 * same toggle + inline-expando interaction, themed for Train Heroic. v1 scope
 * is absolute weight only (no % of Working Max toggle — that fits
 * trainer-curated prescriptions, not a member's own ad-hoc pick).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';

import { MC, MF, MR } from '../../theme/mdbKit';
import MdbIcon from './MdbIcon';

// Sensible per-type defaults for a freshly-selected exercise.
export const newAdhocEntry = () => ({
  sets: '3', reps: '10', weight: '0', rest: '90', time: '01:00', distance: '1',
});

/** entry(ies) → the backend's `exercises[]` bundle payload shape. */
export function adhocEntriesToPayload(map) {
  return [...map.entries()].map(([exerciseId, { entry, exercise }], i) => {
    const type = exercise.measurementType || 'weight_reps';
    const row = {
      exerciseId, order: i + 1,
      sets: parseInt(entry.sets, 10) || 3,
      restSeconds: parseInt(entry.rest, 10) || 90,
      targetReps: null, targetWeight: null, targetTimeSeconds: null, targetDistance: null,
    };
    if (type === 'weight_reps') {
      row.targetReps = parseInt(entry.reps, 10) || 10;
      row.targetWeight = parseFloat(entry.weight) || 0;
      row.weightMode = 'absolute';
    } else if (type === 'reps') {
      row.targetReps = parseInt(entry.reps, 10) || 10;
    } else if (type === 'time') {
      const [m, sec] = String(entry.time || '0:00').split(':').map((p) => parseInt(p, 10) || 0);
      row.targetTimeSeconds = m * 60 + sec;
    } else if (type === 'distance') {
      row.targetDistance = Math.round((parseFloat(entry.distance) || 0) * 1000); // km → m
    }
    return row;
  });
}

export default function AdhocExerciseRow({ exercise, entry, onToggle, onChangeField }) {
  const selected = !!entry;
  return (
    <View>
      <TouchableOpacity style={[s.row, selected && s.rowOn]} onPress={onToggle} activeOpacity={0.8}>
        <View style={s.info}>
          <Text style={s.name} numberOfLines={1}>{exercise.name}</Text>
          {!!exercise.equipmentType && <Text style={s.equip}>{titleCase(exercise.equipmentType)}</Text>}
        </View>
        <MdbIcon
          name={selected ? 'check' : 'plus'}
          size={16}
          color={selected ? MC.violetLight : MC.textTertiary}
        />
      </TouchableOpacity>

      {selected && (
        <View style={s.targets}>
          <TargetInput label="Sets" value={entry.sets} onChange={(v) => onChangeField('sets', v)} />
          <MeasurementInputs exercise={exercise} entry={entry} onChange={onChangeField} />
          <TargetInput label="Rest (s)" value={entry.rest} onChange={(v) => onChangeField('rest', v)} />
        </View>
      )}
    </View>
  );
}

function MeasurementInputs({ exercise, entry, onChange }) {
  const type = exercise.measurementType || 'weight_reps';
  if (type === 'reps') {
    return <TargetInput label="Reps" value={entry.reps} onChange={(v) => onChange('reps', v)} />;
  }
  if (type === 'time') {
    return <TargetInput label="Time (mm:ss)" value={entry.time} keyboard="numbers-and-punctuation" onChange={(v) => onChange('time', v)} />;
  }
  if (type === 'distance') {
    return <TargetInput label="Distance (km)" value={entry.distance} onChange={(v) => onChange('distance', v)} />;
  }
  return (
    <>
      <TargetInput label="Reps" value={entry.reps} onChange={(v) => onChange('reps', v)} />
      <TargetInput label="kg" value={entry.weight} onChange={(v) => onChange('weight', v)} />
    </>
  );
}

function TargetInput({ label, value, onChange, keyboard = 'decimal-pad' }) {
  return (
    <View style={s.targetInput}>
      <Text style={s.targetLabel}>{label}</Text>
      <TextInput
        style={s.targetField}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        placeholderTextColor={MC.textTertiary}
      />
    </View>
  );
}

const titleCase = (s2) => String(s2 || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowOn: { backgroundColor: 'rgba(120,61,236,0.08)' },
  info: { flex: 1, minWidth: 0, marginRight: 12 },
  name: { fontFamily: MF.medium, fontSize: 14, color: MC.text },
  equip: { fontFamily: MF.regular, fontSize: 11, color: MC.textTertiary, marginTop: 2 },

  targets: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'rgba(120,61,236,0.06)',
  },
  targetInput: { flex: 1 },
  targetLabel: { fontFamily: MF.medium, fontSize: 9, color: MC.textTertiary, marginBottom: 3 },
  targetField: {
    backgroundColor: MC.card, borderRadius: MR.sm, borderWidth: 1, borderColor: MC.cardBorder,
    paddingHorizontal: 8, paddingVertical: 6, textAlign: 'center',
    fontFamily: MF.monoSemi, fontSize: 13, color: MC.text,
  },
});
