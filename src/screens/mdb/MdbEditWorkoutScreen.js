/**
 * Edit Workout — change a workout the member added themselves before they
 * start it.
 *
 * Until now scheduling was one-way: a wrong pick had to be lived with or the
 * whole day replaced. This is the room for error — drop an exercise, change
 * how many sets, add more.
 *
 * Only self-added, not-yet-started workouts reach here (the card's overflow
 * menu is the only entrance and it gates on both), which is what keeps the
 * Snapshot Principle intact: nothing already logged can be rewritten. The
 * server does the other half — if this workout still points at a gym
 * template it forks a private copy before applying anything, so a trainer's
 * template is never touched by a member editing their own day.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  StatusBar, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MC, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import { PrimaryCta, EmptyState } from '../../components/mdb/MdbPrimitives';
import { clampSets } from '../../components/mdb/AdhocExerciseRow';
import { updateSelfAssignedExercises } from '../../services/workoutService';
import { secondsToMmss, mmssToSeconds, metersToKm, kmToMeters } from '../../utils/measurement';
import { titleCase } from '../../utils/mdbWorkout';

/** snapshot exercise → the editable row this screen works with. */
const toRow = (ex, i) => ({
  key: `${ex.exerciseId}-${i}`,
  exerciseId: ex.exerciseId,
  name: ex.name || 'Exercise',
  measurementType: ex.measurementType || 'weight_reps',
  equipmentType: ex.equipmentType ?? null,
  sets: String(ex.sets ?? 3),
  rest: String(ex.restSeconds ?? 90),
  time: secondsToMmss(ex.targetTimeSeconds ?? 60),
  distance: String(ex.targetDistance != null ? metersToKm(ex.targetDistance) : 1),
});

/** A row picked fresh from the browser arrives already in payload shape. */
const fromPicked = (row, i) => ({
  key: `${row.exerciseId}-new-${i}-${Date.now()}`,
  exerciseId: row.exerciseId,
  name: row.name || 'Exercise',
  measurementType: row.measurementType || 'weight_reps',
  equipmentType: row.equipmentType ?? null,
  sets: String(row.sets ?? 3),
  rest: String(row.restSeconds ?? 90),
  time: secondsToMmss(row.targetTimeSeconds ?? 60),
  distance: String(row.targetDistance != null ? metersToKm(row.targetDistance) : 1),
});

export default function MdbEditWorkoutScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { workout } = route.params || {};

  const [rows, setRows] = useState(() => (workout?.snapshot?.exercises || []).map(toRow));
  const [saving, setSaving] = useState(false);

  const setField = (key, field, value) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const removeRow = (key) => {
    const row = rows.find((r) => r.key === key);
    Alert.alert(
      'Remove exercise?',
      `${row?.name || 'This exercise'} will be dropped from this workout.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => setRows((prev) => prev.filter((r) => r.key !== key)) },
      ],
    );
  };

  const addExercises = () => {
    navigation.navigate('MdbTemplateBrowser', {
      pickOnly: true,
      onPicked: (picked) => {
        setRows((prev) => {
          // The same exercise twice in one workout would collide on save
          // (one template row per exercise), so skip anything already here.
          const have = new Set(prev.map((r) => r.exerciseId));
          return [...prev, ...picked.filter((p) => !have.has(p.exerciseId)).map(fromPicked)];
        });
      },
    });
  };

  const save = useCallback(async () => {
    if (saving) return;
    if (!rows.length) {
      Alert.alert('Nothing left', 'Keep at least one exercise, or remove the whole workout instead.');
      return;
    }
    setSaving(true);
    try {
      await updateSelfAssignedExercises(workout.id, rows.map((r, i) => {
        const payload = {
          exerciseId: r.exerciseId,
          order: i + 1,
          sets: parseInt(clampSets(r.sets), 10),
          restSeconds: parseInt(r.rest, 10) || 90,
          // Reps and weight stay unset on purpose — they're chosen set by set
          // in the session, and a null weight lets the server carry forward
          // whatever the member last lifted for this exercise.
          targetReps: null, targetWeight: null,
          targetTimeSeconds: null, targetDistance: null,
        };
        if (r.measurementType === 'time') payload.targetTimeSeconds = mmssToSeconds(r.time);
        if (r.measurementType === 'distance') payload.targetDistance = kmToMeters(r.distance);
        return payload;
      }));
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not save', e?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [rows, saving, workout?.id, navigation]);

  if (!workout?.id) {
    return (
      <View style={s.screen}>
        <EmptyState title="Workout unavailable" subtitle="Go back and open it again." />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      <View style={[s.topBar, { marginTop: insets.top }]}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MdbIcon name="chevron-left" size={20} color={MC.textSecondary} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>{workout?.snapshot?.name || 'Edit Workout'}</Text>
        <View style={s.iconBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.hint}>
            Reps and weight are chosen set by set while you train — set how many
            sets and how long you rest here.
          </Text>

          {rows.map((r) => (
            <View key={r.key} style={s.row}>
              <View style={s.rowHead}>
                <View style={s.rowHeadText}>
                  <Text style={s.rowName} numberOfLines={1}>{r.name}</Text>
                  {!!r.equipmentType && <Text style={s.rowEquip}>{titleCase(r.equipmentType)}</Text>}
                </View>
                <TouchableOpacity onPress={() => removeRow(r.key)} activeOpacity={0.7} hitSlop={10}>
                  <MdbIcon name="trash" size={16} color={MC.workedSolid} />
                </TouchableOpacity>
              </View>

              <View style={s.fields}>
                <Field
                  label="Sets"
                  value={r.sets}
                  onChange={(v) => setField(r.key, 'sets', v)}
                  onBlur={() => setField(r.key, 'sets', clampSets(r.sets))}
                />
                {r.measurementType === 'time' && (
                  <Field
                    label="Time (mm:ss)" value={r.time} keyboard="numbers-and-punctuation"
                    onChange={(v) => setField(r.key, 'time', v)}
                  />
                )}
                {r.measurementType === 'distance' && (
                  <Field
                    label="Distance (km)" value={r.distance}
                    onChange={(v) => setField(r.key, 'distance', v)}
                  />
                )}
                <Field label="Rest (s)" value={r.rest} onChange={(v) => setField(r.key, 'rest', v)} />
              </View>
            </View>
          ))}

          {rows.length === 0 && (
            <Text style={s.emptyNote}>
              No exercises left. Add at least one, or go back and remove the workout.
            </Text>
          )}

          <TouchableOpacity style={s.addRow} onPress={addExercises} activeOpacity={0.7}>
            <MdbIcon name="plus" size={14} color={MC.violetLight} />
            <Text style={s.addText}>Add exercises</Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[s.saveBar, { paddingBottom: 12 + insets.bottom }]}>
        <PrimaryCta
          label={saving ? 'SAVING…' : 'SAVE CHANGES'}
          onPress={save}
          disabled={saving || rows.length === 0}
          icon={null}
        />
        {saving && <ActivityIndicator style={s.savingSpinner} color={MC.violetLight} size="small" />}
      </View>
    </View>
  );
}

function Field({ label, value, onChange, onBlur, keyboard = 'number-pad' }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.fieldInput}
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        keyboardType={keyboard}
        selectionColor={MC.violetLight}
        placeholderTextColor={MC.textTertiary}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MC.bg },
  topBar: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: MS.hMargin,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: MF.semibold, fontSize: 16, color: MC.text },

  scroll: { paddingHorizontal: MS.hMargin, paddingTop: 14, gap: 10 },
  hint: { fontFamily: MF.regular, fontSize: 11, color: MC.textTertiary, lineHeight: 16, marginBottom: 2 },

  row: {
    backgroundColor: MC.card, borderRadius: MR.card,
    borderWidth: 1, borderColor: MC.cardBorder, padding: 12, gap: 10,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowHeadText: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: MF.medium, fontSize: 14, color: MC.text },
  rowEquip: { fontFamily: MF.regular, fontSize: 11, color: MC.textTertiary, marginTop: 2 },

  fields: { flexDirection: 'row', gap: 8 },
  field: { flex: 1 },
  fieldLabel: { fontFamily: MF.medium, fontSize: 9, color: MC.textTertiary, marginBottom: 3 },
  fieldInput: {
    backgroundColor: MC.cardAlt, borderRadius: MR.sm,
    borderWidth: 1, borderColor: MC.cardBorder,
    paddingHorizontal: 8, paddingVertical: 6, textAlign: 'center',
    fontFamily: MF.monoSemi, fontSize: 13, color: MC.text,
  },

  emptyNote: {
    fontFamily: MF.regular, fontSize: 12, color: MC.textTertiary,
    textAlign: 'center', paddingVertical: 20,
  },

  addRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, borderRadius: MR.button, marginTop: 4,
    borderWidth: 1, borderColor: 'rgba(120,61,236,0.35)', borderStyle: 'dashed',
  },
  addText: { fontFamily: MF.medium, fontSize: 12, color: MC.violetLight },

  saveBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: MS.hMargin, paddingTop: 12,
    backgroundColor: MC.bg, borderTopWidth: 1, borderTopColor: MC.cardBorder,
  },
  savingSpinner: { position: 'absolute', right: MS.hMargin + 16, top: 26 },
});
