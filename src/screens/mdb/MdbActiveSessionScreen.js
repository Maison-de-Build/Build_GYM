/**
 * Screen 03 — Active Workout Session ("live workbench").
 * Port of `screen_03_active_workout.html`.
 *
 * Layout, top to bottom, matching the pack's fixed regions:
 *   44pt top bar   close · session name · gradient live timer
 *   44pt strip     wearable telemetry — dummy + inert until Part C ships
 *   scroll         exercise accordion: done (collapsed, amber tick) ·
 *                  active (expanded workbench) · upcoming (0.6 opacity)
 *   80pt bar       "n of m done" progress + FINISH WORKOUT
 *
 * The workbench card carries the 3px gradient left edge, the SET/REPS/KG/STATUS
 * table with a pulsing dot on the current row, Add Set, the set-type cycler and
 * the rest timer with its draining 3px bar and ±15s flanking buttons.
 *
 * Logging is real: startInstance/startWorkout → logSet (optimistic, idempotent)
 * → completeWorkout, the same contract the existing session screen uses.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  StatusBar, Alert, ActivityIndicator, Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { MC, MG, MF, MR } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import GradientText from '../../components/mdb/GradientText';
import { GradientRing } from '../../components/mdb/MdbPrimitives';
import MdbPlateCalcSheet from '../../components/mdb/MdbPlateCalcSheet';
import WearableStrip from '../../components/mdb/WearableStrip';
import {
  startInstance, startWorkout, fetchActiveWorkout, getWorkoutSets,
  logSet, completeWorkout,
} from '../../services/workoutService';
import { sequenceOf, targetLine } from '../../utils/mdbWorkout';
import { secondsToMmss } from '../../utils/measurement';

const SET_TYPES = ['working', 'warmup', 'drop', 'failure'];
const SET_TYPE_LABEL = { working: 'Working', warmup: 'Warm-up', drop: 'Drop', failure: 'Failure' };

export default function MdbActiveSessionScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { instanceId, instance, planId, plan, muscleGroups, selfLogExercises } = route.params || {};
  const isInstance = !!instanceId;

  const [log, setLog] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [setsByExercise, setSetsByExercise] = useState({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [setType, setSetType] = useState('working');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [plateFor, setPlateFor] = useState(null);

  // Live session timer + rest countdown.
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState(null); // { remaining, total }
  const startedAtRef = useRef(null);

  /* ── Bootstrap ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        let session;
        if (isInstance) {
          session = await startInstance(instanceId);
          // Prefer the server's copy of the snapshot; fall back to the row the
          // calendar handed us so the screen still renders if start() thins it.
          const seq = sequenceOf(session);
          setExercises(buildList(seq.length ? seq : sequenceOf(instance)));
          if (session?.sets?.length) setSetsByExercise(groupSets(session.sets));
        } else {
          session = (planId ? await fetchActiveWorkout(planId) : null)
            || await startWorkout(planId ? { planId } : { muscleGroups: muscleGroups || [] });
          if (session?.status === 'completed' || session?.status === 'partial' || session?.alreadyCompleted) {
            navigation.replace('MdbWorkoutSummary', { workoutLogId: session.id });
            return;
          }
          const source = plan?.exercises?.length ? plan.exercises : (selfLogExercises || session.exercises || []);
          setExercises(buildList(withLetters(source)));
          if (session?.sets?.length) setSetsByExercise(groupSets(session.sets));
          else if (session?.resumed && session?.id) {
            try { setSetsByExercise(groupSets(await getWorkoutSets(session.id) || [])); } catch { /* best effort */ }
          }
        }
        setLog(session);
        startedAtRef.current = session?.startedAt ? new Date(session.startedAt).getTime() : Date.now();
      } catch (e) {
        Alert.alert('Error', e?.response?.data?.message || 'Could not start workout');
        navigation.goBack();
        return;
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Session clock — recomputed from startedAt so it survives backgrounding.
  useEffect(() => {
    const id = setInterval(() => {
      if (startedAtRef.current) setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Rest countdown.
  useEffect(() => {
    if (!rest) return undefined;
    if (rest.remaining <= 0) { setRest(null); return undefined; }
    const id = setTimeout(() => setRest((r) => (r ? { ...r, remaining: r.remaining - 1 } : null)), 1000);
    return () => clearTimeout(id);
  }, [rest]);

  /* ── Derived ───────────────────────────────────────────────────────────── */
  const current = exercises[activeIndex] || null;
  const currentSets = (current && setsByExercise[current.id]) || [];
  const nextSetNumber = currentSets.length + 1;
  const totalTarget = current?.targetSets || Math.max(currentSets.length + 1, 1);

  const doneCount = useMemo(
    () => exercises.filter((ex) => {
      const logged = (setsByExercise[ex.id] || []).length;
      return logged > 0 && (!ex.targetSets || logged >= ex.targetSets);
    }).length,
    [exercises, setsByExercise],
  );

  // Prefill the current row: carry the last logged values forward, else target.
  useEffect(() => {
    if (!current) return;
    const last = currentSets[currentSets.length - 1];
    setReps(String(last?.actualReps ?? current.targetReps ?? ''));
    setWeight(String(last?.actualWeight ?? current.targetWeight ?? ''));
  }, [current?.id, currentSets.length]);

  /* ── Log one set ───────────────────────────────────────────────────────── */
  const logCurrentSet = async () => {
    if (!current || !log?.id) return;
    const setNumber = nextSetNumber;
    const values = valuesFor(current.measurementType, reps, weight);
    const idempotencyKey = `${log.id}:${current.id}:${setNumber}`;

    // Optimistic — the row lands immediately, reconciled on response.
    setSetsByExercise((prev) => ({
      ...prev,
      [current.id]: [...(prev[current.id] || []), { setNumber, setType, ...values, pending: true }],
    }));
    setRest({ remaining: current.restSeconds || 90, total: current.restSeconds || 90 });

    try {
      const res = await logSet(log.id, {
        exerciseId: current.id, setNumber, ...values, setType,
        idempotencyKey, clientTs: new Date().toISOString(),
      });
      const isPr = (res?.data?.prsHit || []).length > 0;
      setSetsByExercise((prev) => ({
        ...prev,
        [current.id]: (prev[current.id] || []).map((st) =>
          st.setNumber === setNumber && st.pending ? { ...st, isPr, pending: false } : st),
      }));
    } catch {
      // Keep it flagged; the idempotency key makes a later retry safe.
      setSetsByExercise((prev) => ({
        ...prev,
        [current.id]: (prev[current.id] || []).map((st) =>
          st.setNumber === setNumber && st.pending ? { ...st, unsynced: true, pending: false } : st),
      }));
    }
  };

  const finish = () => {
    if (finishing || !log?.id) return;
    Alert.alert('Finish workout?', 'Your logged sets will be saved and the session closed.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Finish',
        style: 'destructive',
        onPress: async () => {
          setFinishing(true);
          try {
            await completeWorkout(log.id);
            navigation.replace('MdbWorkoutSummary', { workoutLogId: log.id });
          } catch (e) {
            setFinishing(false);
            Alert.alert('Error', e?.response?.data?.message || 'Could not finish workout');
          }
        },
      },
    ]);
  };

  const confirmExit = () => {
    Alert.alert('End workout?', 'You can come back and finish this session later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  if (loading) {
    return (
      <View style={[s.screen, s.center]}>
        <ActivityIndicator color={MC.violetLight} />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      {/* ── 44pt top bar ─────────────────────────────────────────────────── */}
      <View style={[s.topBar, { marginTop: insets.top }]}>
        <TouchableOpacity style={s.closeBtn} onPress={confirmExit} activeOpacity={0.7} hitSlop={8}>
          <MdbIcon name="x" size={20} color={MC.textSecondary} />
        </TouchableOpacity>
        <Text style={s.sessionName} numberOfLines={1}>
          {log?.snapshot?.name || plan?.name || 'Workout'}
        </Text>
        <GradientText style={s.timer}>{secondsToMmss(elapsed)}</GradientText>
      </View>

      {/* ── 44pt live tracker strip (inert until wearables ship) ─────────── */}
      <WearableStrip elapsedSeconds={elapsed} />

      {/* ── Exercise accordion ───────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {exercises.map((ex, i) => {
          const logged = setsByExercise[ex.id] || [];
          const isDone = logged.length > 0 && (!ex.targetSets || logged.length >= ex.targetSets);
          const isActive = i === activeIndex;

          if (isActive) {
            return (
              <ActiveExerciseCard
                key={ex.id}
                exercise={ex}
                sets={logged}
                setNumber={nextSetNumber}
                totalTarget={totalTarget}
                reps={reps}
                weight={weight}
                onReps={setReps}
                onWeight={setWeight}
                setType={setType}
                onCycleSetType={() =>
                  setSetType((t) => SET_TYPES[(SET_TYPES.indexOf(t) + 1) % SET_TYPES.length])}
                onLog={logCurrentSet}
                rest={rest}
                onAdjustRest={(delta) =>
                  setRest((r) => (r ? { ...r, remaining: Math.max(0, r.remaining + delta) } : r))}
                onPlateCalc={() => setPlateFor(ex)}
              />
            );
          }

          return (
            <CollapsedExercise
              key={ex.id}
              exercise={ex}
              sets={logged}
              done={isDone}
              queueLabel={i === activeIndex + 1 ? 'Next' : 'Queue'}
              onPress={() => setActiveIndex(i)}
            />
          );
        })}
      </ScrollView>

      {/* ── 80pt sticky finish bar ───────────────────────────────────────── */}
      <View style={[s.bottomBar, { paddingBottom: 24 + insets.bottom }]}>
        <View style={s.progressBlock}>
          <View style={s.progressLabelRow}>
            <Text style={s.progressCount}>{doneCount}</Text>
            <Text style={s.progressOf}>of {exercises.length} done</Text>
          </View>
          <View style={s.progressTrack}>
            <LinearGradient
              colors={MG.primary}
              start={MG.startX}
              end={MG.endX}
              style={[s.progressFill, {
                width: `${exercises.length ? (doneCount / exercises.length) * 100 : 0}%`,
              }]}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[s.finishBtn, doneCount > 0 && s.finishBtnReady]}
          onPress={finish}
          activeOpacity={0.85}
          disabled={finishing}
        >
          <Text style={[s.finishText, doneCount > 0 && s.finishTextReady]}>
            {finishing ? 'FINISHING…' : 'FINISH WORKOUT'}
          </Text>
        </TouchableOpacity>
      </View>

      <MdbPlateCalcSheet
        exercise={plateFor}
        targetWeight={Number(weight) || plateFor?.targetWeight || 0}
        onClose={() => setPlateFor(null)}
      />
    </View>
  );
}

/* ── Collapsed row: completed (amber tick) or upcoming (0.6 opacity) ─────── */
function CollapsedExercise({ exercise, sets, done, queueLabel, onPress }) {
  const summary = done && sets.length
    ? `${sets.length} × ${sets.map((st) => st.actualReps ?? '—').join(', ')} @ ${uniqueWeights(sets)}`
    : targetLine(exercise);

  return (
    <TouchableOpacity
      style={[s.collapsed, !done && s.collapsedUpcoming]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={s.collapsedLeft}>
        <GradientRing size={28}>
          <Text style={[s.letter, !done && s.letterDim]}>{exercise.letter}</Text>
        </GradientRing>
        <View style={s.collapsedBody}>
          <Text style={s.collapsedName} numberOfLines={1}>{exercise.name}</Text>
          <Text style={[s.collapsedTarget, !done && s.collapsedTargetDim]} numberOfLines={1}>{summary}</Text>
        </View>
      </View>

      {done ? (
        <View style={s.doneBadge}>
          <MdbIcon name="check" size={12} color={MC.warm} />
        </View>
      ) : (
        <Text style={s.queueLabel}>{queueLabel}</Text>
      )}
    </TouchableOpacity>
  );
}

/* ── The expanded workbench card ─────────────────────────────────────────── */
function ActiveExerciseCard({
  exercise, sets, setNumber, totalTarget, reps, weight, onReps, onWeight,
  setType, onCycleSetType, onLog, rest, onAdjustRest, onPlateCalc,
}) {
  const isBarbell = exercise.equipmentType === 'barbell';
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={s.activeCard}>
      {/* 3px gradient left edge */}
      <LinearGradient colors={MG.primary} start={MG.startY} end={MG.endY} style={s.activeEdge} />

      {/* Header */}
      <View style={s.activeHeadRow}>
        <View style={s.activeHeadLeft}>
          <GradientRing size={28}>
            <Text style={s.letter}>{exercise.letter}</Text>
          </GradientRing>
          <Text style={s.activeName} numberOfLines={1}>{exercise.name}</Text>
        </View>
        <View style={s.activeBadge}>
          <Text style={s.activeBadgeText}>Active</Text>
        </View>
      </View>

      <View style={s.activeSubRow}>
        <Text style={s.activeTarget}>Target: {targetLine(exercise)}</Text>
        {isBarbell && (
          <TouchableOpacity style={s.plateLink} onPress={onPlateCalc} activeOpacity={0.7}>
            <Text style={s.plateLinkText}>Plate calc</Text>
            <MdbIcon name="target" size={12} color={MC.violet} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Set table ──────────────────────────────────────────────────── */}
      <View style={s.table}>
        <View style={s.tableHead}>
          <Text style={[s.th, s.colSet]}>SET</Text>
          <Text style={[s.th, s.colMid]}>REPS</Text>
          <Text style={[s.th, s.colMid]}>KG</Text>
          <Text style={[s.th, s.colStatus]}>STATUS</Text>
        </View>

        {sets.map((st) => (
          <View key={st.setNumber} style={s.tableRowDone}>
            <Text style={[s.tdIndex, s.colSet]}>{st.setNumber}</Text>
            <Text style={[s.tdValue, s.colMid]}>{st.actualReps ?? '—'}</Text>
            <Text style={[s.tdValue, s.colMid]}>{fmtKg(st.actualWeight)}</Text>
            <View style={[s.colStatus, s.statusCell]}>
              {st.unsynced
                ? <MdbIcon name="refresh" size={14} color={MC.textTertiary} />
                : <MdbIcon name="check" size={16} color={MC.warm} />}
            </View>
          </View>
        ))}

        {/* Current set row */}
        <View style={s.tableRowCurrent}>
          <View style={[s.colSet, s.currentIndexCell]}>
            <Animated.View style={{ opacity: pulse }}>
              <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.pulseDot} />
            </Animated.View>
            <Text style={s.tdIndexCurrent}>{setNumber}</Text>
          </View>

          <View style={[s.colMid, s.inputCell]}>
            <TextInput
              style={s.input}
              value={reps}
              onChangeText={onReps}
              keyboardType="number-pad"
              placeholder={String(exercise.targetReps ?? '')}
              placeholderTextColor={MC.textTertiary}
              selectionColor={MC.violetLight}
            />
          </View>

          <View style={[s.colMid, s.inputCell]}>
            <TextInput
              style={s.input}
              value={weight}
              onChangeText={onWeight}
              keyboardType="decimal-pad"
              placeholder={String(exercise.targetWeight ?? '')}
              placeholderTextColor={MC.textTertiary}
              selectionColor={MC.violetLight}
            />
          </View>

          <View style={[s.colStatus, s.statusCell]}>
            <TouchableOpacity onPress={onLog} activeOpacity={0.85}>
              <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.logBtn}>
                <MdbIcon name="check-bold" size={16} color={MC.white} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Action chips ───────────────────────────────────────────────── */}
      <View style={s.chipRow}>
        <View style={s.addSet}>
          <Text style={s.addSetHint}>
            Set {setNumber}{totalTarget ? ` of ${totalTarget}` : ''}
          </Text>
        </View>
        <TouchableOpacity style={s.typeChip} onPress={onCycleSetType} activeOpacity={0.8}>
          <View style={s.typeDot} />
          <Text style={s.typeText}>Type: {SET_TYPE_LABEL[setType]}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Rest timer ─────────────────────────────────────────────────── */}
      {!!rest && (
        <View style={s.restBlock}>
          <View style={s.restTrack}>
            <LinearGradient
              colors={MG.primary}
              start={MG.startX}
              end={MG.endX}
              style={[s.restFill, { width: `${(rest.remaining / Math.max(1, rest.total)) * 100}%` }]}
            />
          </View>
          <View style={s.restRow}>
            <TouchableOpacity style={s.restAdjust} onPress={() => onAdjustRest(-15)} activeOpacity={0.7}>
              <Text style={s.restAdjustText}>−15s</Text>
            </TouchableOpacity>

            <View style={s.restCenter}>
              <MdbIcon name="clock" size={12} color={MC.cyan} />
              <Text style={s.restTime}>{secondsToMmss(rest.remaining)}</Text>
              <Text style={s.restLabel}>REST</Text>
            </View>

            <TouchableOpacity style={s.restAdjust} onPress={() => onAdjustRest(15)} activeOpacity={0.7}>
              <Text style={s.restAdjustText}>+15s</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */
const withLetters = (list = []) =>
  list.map((ex, i) => ({ ...ex, letter: String.fromCharCode(65 + i) }));

const buildList = (seq = []) =>
  seq.map((ex) => ({
    id: ex.exerciseId || ex.id,
    letter: ex.letter,
    name: ex.name,
    measurementType: ex.measurementType || 'weight_reps',
    targetSets: ex.sets ?? ex.targetSets ?? null,
    targetReps: ex.targetReps ?? null,
    targetWeight: ex.targetWeight ?? null,
    targetTimeSeconds: ex.targetTimeSeconds ?? null,
    targetDistance: ex.targetDistance ?? null,
    restSeconds: ex.restSeconds ?? 90,
    equipmentType: ex.equipmentType ?? null,
    barWeightOverrideKg: ex.barWeightOverrideKg ?? null,
    weightSource: ex.weightSource ?? null,
  }));

const groupSets = (rows = []) => {
  const out = {};
  for (const r of rows) {
    const k = r.exerciseId;
    if (!out[k]) out[k] = [];
    out[k].push(r);
  }
  Object.values(out).forEach((list) => list.sort((a, b) => a.setNumber - b.setNumber));
  return out;
};

const valuesFor = (type, reps, weight) => {
  switch (type) {
    case 'reps': return { actualReps: Number(reps) || 0 };
    case 'time': return { actualTimeSeconds: Number(reps) || 0 };
    case 'distance': return { actualDistance: Number(reps) || 0 };
    default: return { actualReps: Number(reps) || 0, actualWeight: Number(weight) || 0 };
  }
};

const fmtKg = (v) => (v == null ? '—' : Number(v).toFixed(1));

const uniqueWeights = (sets) => {
  const ws = sets.map((st) => st.actualWeight).filter((w) => w != null);
  if (!ws.length) return 'Bodyweight';
  return `${[...new Set(ws)].join(', ')} kg`;
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MC.bg },
  center: { alignItems: 'center', justifyContent: 'center' },

  /* Top bar */
  topBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  sessionName: {
    flex: 1, textAlign: 'center', maxWidth: 190,
    fontFamily: MF.medium, fontSize: 14, color: MC.text, letterSpacing: -0.2,
  },
  timer: {
    fontFamily: MF.monoSemi, fontSize: 14, letterSpacing: 1,
    fontVariant: ['tabular-nums'], color: MC.violet,
  },

  scroll: { padding: 16, gap: 14, paddingBottom: 24 },

  /* Collapsed rows */
  collapsed: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, backgroundColor: MC.card,
    borderWidth: 1, borderColor: MC.cardBorder, borderRadius: MR.card,
  },
  collapsedUpcoming: { opacity: 0.6 },
  collapsedLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  collapsedBody: { flex: 1, minWidth: 0 },
  collapsedName: { fontFamily: MF.medium, fontSize: 14, color: MC.text },
  collapsedTarget: {
    fontFamily: MF.mono, fontSize: 12, color: MC.textSecondary,
    fontVariant: ['tabular-nums'], marginTop: 2,
  },
  collapsedTargetDim: { color: MC.textTertiary },
  letter: { fontFamily: MF.semibold, fontSize: 12, color: MC.text },
  letterDim: { color: MC.textTertiary },
  doneBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderWidth: 1, borderColor: 'rgba(245,166,35,0.40)',
    alignItems: 'center', justifyContent: 'center',
  },
  queueLabel: { fontFamily: MF.mono, fontSize: 10, color: MC.textTertiary },

  /* Active card */
  activeCard: {
    backgroundColor: MC.card,
    borderWidth: 1, borderColor: MC.cardBorder, borderRadius: MR.card,
    borderLeftWidth: 0,
    padding: 16, paddingLeft: 19, gap: 16,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  activeEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },

  activeHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  activeName: { fontFamily: MF.semibold, fontSize: 16, color: MC.text, flex: 1 },
  activeBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: MR.xs,
    backgroundColor: 'rgba(6,180,213,0.10)',
    borderWidth: 1, borderColor: 'rgba(6,180,213,0.30)',
  },
  activeBadgeText: {
    fontFamily: MF.semibold, fontSize: 10, color: MC.cyan,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  activeSubRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingLeft: 38, marginTop: -12,
  },
  activeTarget: { fontFamily: MF.medium, fontSize: 13, color: MC.textSecondary },
  plateLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  plateLinkText: {
    fontFamily: MF.regular, fontSize: 11, color: MC.textSecondary,
    textDecorationLine: 'underline',
  },

  /* Table */
  table: {
    backgroundColor: '#0B0811', borderRadius: 12,
    borderWidth: 1, borderColor: MC.cardBorder, overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: MC.cardBorder,
  },
  th: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  colSet: { flex: 2 },
  colMid: { flex: 4, textAlign: 'center' },
  colStatus: { flex: 2, textAlign: 'right' },

  tableRowDone: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  tableRowCurrent: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: 'rgba(120,61,236,0.05)',
    borderLeftWidth: 2, borderLeftColor: MC.violet,
  },
  tdIndex: {
    fontFamily: MF.mono, fontSize: 13, color: MC.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  tdIndexCurrent: {
    fontFamily: MF.monoSemi, fontSize: 13, color: MC.text,
    fontVariant: ['tabular-nums'],
  },
  tdValue: {
    fontFamily: MF.monoSemi, fontSize: 15, color: MC.text,
    textAlign: 'center', fontVariant: ['tabular-nums'],
  },
  currentIndexCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pulseDot: { width: 8, height: 8, borderRadius: 4 },
  statusCell: { alignItems: 'flex-end', justifyContent: 'center' },
  inputCell: { alignItems: 'center', justifyContent: 'center' },
  input: {
    width: 64, height: 36, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    textAlign: 'center',
    fontFamily: MF.monoSemi, fontSize: 15, color: MC.text,
    paddingVertical: 0,
  },
  logBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  /* Chips */
  chipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -4 },
  addSet: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addSetHint: { fontFamily: MF.medium, fontSize: 11, color: MC.textTertiary },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: MR.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  typeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  typeText: { fontFamily: MF.semibold, fontSize: 10, color: MC.textSecondary },

  /* Rest timer */
  restBlock: { paddingTop: 12, borderTopWidth: 1, borderTopColor: MC.cardBorder, gap: 8 },
  restTrack: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  restFill: { height: '100%', borderRadius: 2 },
  restRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  restAdjust: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: MR.xs,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  restAdjustText: { fontFamily: MF.medium, fontSize: 11, color: MC.textTertiary },
  restCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  restTime: {
    fontFamily: MF.monoSemi, fontSize: 13, color: MC.text,
    fontVariant: ['tabular-nums'],
  },
  restLabel: {
    fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary,
    letterSpacing: 0.6, textTransform: 'uppercase',
  },

  /* Bottom bar */
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 16, paddingTop: 10,
    backgroundColor: MC.bg,
    borderTopWidth: 1, borderTopColor: MC.cardBorder,
  },
  progressBlock: { minWidth: 75, justifyContent: 'center' },
  progressLabelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  progressCount: {
    fontFamily: MF.semibold, fontSize: 14, color: MC.text,
    fontVariant: ['tabular-nums'],
  },
  progressOf: { fontFamily: MF.regular, fontSize: 11, color: MC.textTertiary },
  progressTrack: {
    height: 6, borderRadius: 3, marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },

  finishBtn: {
    flex: 1, height: 44, borderRadius: MR.button,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: MC.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  finishBtnReady: { borderColor: 'rgba(255,255,255,0.15)' },
  finishText: {
    fontFamily: MF.semibold, fontSize: 13, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textSecondary,
  },
  finishTextReady: { color: MC.text },
});
