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
import {
  secondsToMmss, mmssToSeconds, metersToKm, kmToMeters, inputFieldsFor,
} from '../../utils/measurement';

// DB truth (set_logs.set_type enum): normal | warmup | drop | failure. There is
// no 'working' value — sending it silently fails every insert (Postgres
// rejects the enum, the route 500s), which is why a whole session of sets
// could show as logged in the UI and never actually land in the database.
const SET_TYPES = ['normal', 'warmup', 'drop', 'failure'];
const SET_TYPE_LABEL = { normal: 'Working', warmup: 'Warm-up', drop: 'Drop', failure: 'Failure' };

export default function MdbActiveSessionScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { instanceId, instance, planId, plan, muscleGroups, selfLogExercises } = route.params || {};
  const isInstance = !!instanceId;

  const [log, setLog] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [setsByExercise, setSetsByExercise] = useState({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [setType, setSetType] = useState('normal');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  // Time and distance used to be typed into the `reps` box under a "REPS"
  // label; they get their own state and their own column now.
  const [timeText, setTimeText] = useState('');
  const [distText, setDistText] = useState('');
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
    setReps(str(last?.actualReps ?? current.targetReps));
    // A zero target must not seed the box with "0.00": it is not a weight, and
    // the set would be refused for exactly that on submit. Leave it empty so
    // the member types what they actually lifted.
    const seedWeight = last?.actualWeight ?? current.targetWeight;
    setWeight(Number(seedWeight) > 0 ? str(seedWeight) : '');
    const secs = last?.actualTimeSeconds ?? current.targetTimeSeconds;
    setTimeText(secs != null ? secondsToMmss(secs) : '');
    const metres = last?.actualDistance ?? current.targetDistance;
    setDistText(metres != null ? String(metersToKm(metres)) : '');
  }, [current?.id, currentSets.length]);

  // A plate-calc sheet left open across an exercise switch would confirm its
  // stale target weight onto whichever exercise is now current (the sheet's
  // onConfirm writes to the screen's single shared `weight` state) — close it
  // the instant the active exercise changes so that can't happen.
  useEffect(() => { setPlateFor(null); }, [activeIndex]);

  /**
   * The next exercise still owing sets, searching forward from `from` and
   * wrapping — a member who jumped back to an earlier exercise should still be
   * carried forward to whatever is genuinely left, not dumped at the end.
   * Returns -1 when the whole workout is done.
   */
  const nextUnfinishedIndex = useCallback((from, sets) => {
    const owing = (ex) => {
      const logged = (sets[ex.id] || []).length;
      return !ex.targetSets || logged < ex.targetSets;
    };
    for (let i = 1; i <= exercises.length; i += 1) {
      const idx = (from + i) % exercises.length;
      if (owing(exercises[idx])) return idx;
    }
    return -1;
  }, [exercises]);

  /* ── Log one set ───────────────────────────────────────────────────────── */
  const logCurrentSet = async () => {
    if (!current || !log?.id) return;
    // Fewer sets than planned is fine; more is not (Doc-N round-4 §4).
    if (current.targetSets && currentSets.length >= current.targetSets) return;
    const values = valuesFor(current, { reps, weight, timeText, distText });
    // Backs the disabled button below — never post a set the server will
    // reject (0 kg on a loaded lift, a weight on a plank, missing reps).
    if (setValueError(current, values)) return;
    const setNumber = nextSetNumber;
    const idempotencyKey = `${log.id}:${current.id}:${setNumber}`;

    // Optimistic — the row lands immediately, reconciled on response.
    setSetsByExercise((prev) => ({
      ...prev,
      [current.id]: [...(prev[current.id] || []), { setNumber, setType, ...values, pending: true }],
    }));
    setRest({ remaining: current.restSeconds || 90, total: current.restSeconds || 90 });

    // That set finished this exercise — move on rather than parking on a card
    // that has nothing left to log. The optimistic row is already in, so the
    // advance is computed against the post-write state, not the stale one.
    if (current.targetSets && setNumber >= current.targetSets) {
      const after = { ...setsByExercise, [current.id]: [...currentSets, { setNumber }] };
      const nextIdx = nextUnfinishedIndex(activeIndex, after);
      if (nextIdx >= 0) setActiveIndex(nextIdx);
    }

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

  /**
   * One more attempt at every set still flagged `unsynced`, run right before
   * finishing. The idempotency key is deterministic (log id + exercise +
   * set number), so retrying is always safe even if an earlier attempt
   * actually landed and only the response was lost.
   *
   * Returns the count still failing after the retry, so `finish()` can warn
   * before completing a workout with missing data instead of doing it silently
   * — which is exactly how the set-type enum bug went unnoticed for a week.
   */
  const retryUnsyncedSets = async () => {
    const pending = [];
    for (const [exerciseId, sets] of Object.entries(setsByExercise)) {
      for (const st of sets) if (st.unsynced) pending.push({ exerciseId, ...st });
    }
    if (!pending.length) return 0;

    let stillFailing = 0;
    for (const st of pending) {
      const idempotencyKey = `${log.id}:${st.exerciseId}:${st.setNumber}`;
      try {
        await logSet(log.id, {
          exerciseId: st.exerciseId, setNumber: st.setNumber, setType: st.setType,
          actualReps: st.actualReps, actualWeight: st.actualWeight,
          actualTimeSeconds: st.actualTimeSeconds, actualDistance: st.actualDistance,
          idempotencyKey, clientTs: new Date().toISOString(),
        });
        setSetsByExercise((prev) => ({
          ...prev,
          [st.exerciseId]: (prev[st.exerciseId] || []).map((s) =>
            s.setNumber === st.setNumber ? { ...s, unsynced: false } : s),
        }));
      } catch {
        stillFailing += 1;
      }
    }
    return stillFailing;
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
            const stillFailing = await retryUnsyncedSets();
            if (stillFailing > 0) {
              const proceed = await new Promise((resolve) => {
                Alert.alert(
                  'Some sets could not be saved',
                  `${stillFailing} set${stillFailing === 1 ? '' : 's'} failed to sync and won't be included in this workout. Finish anyway?`,
                  [
                    { text: 'Keep going', style: 'cancel', onPress: () => resolve(false) },
                    { text: 'Finish anyway', style: 'destructive', onPress: () => resolve(true) },
                  ],
                );
              });
              if (!proceed) { setFinishing(false); return; }
            }
            await completeWorkout(log.id);
            navigation.replace('MdbWorkoutSummary', { workoutLogId: log.id, live: true });
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
                timeText={timeText}
                distText={distText}
                onReps={setReps}
                onWeight={setWeight}
                onTime={setTimeText}
                onDist={setDistText}
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
        onConfirm={(w) => setWeight(String(w))}
        onClose={() => setPlateFor(null)}
      />
    </View>
  );
}

/* ── Collapsed row: completed (amber tick) or upcoming (0.6 opacity) ─────── */
function CollapsedExercise({ exercise, sets, done, queueLabel, onPress }) {
  const summary = done && sets.length ? loggedSummary(exercise, sets) : targetLine(exercise);

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
  exercise, sets, setNumber, totalTarget, reps, weight, timeText, distText,
  onReps, onWeight, onTime, onDist,
  setType, onCycleSetType, onLog, rest, onAdjustRest, onPlateCalc,
}) {
  const type = exercise.measurementType || 'weight_reps';
  // The table used to be a fixed SET/REPS/KG grid for every type, so a plank
  // asked for reps and kilos. inputFieldsFor is the pack's own answer to
  // which boxes a type needs.
  const fields = inputFieldsFor(type);
  const isBarbell = exercise.equipmentType === 'barbell';
  const capped = !!exercise.targetSets && sets.length >= exercise.targetSets;
  const values = valuesFor(exercise, { reps, weight, timeText, distText });
  const valueError = setValueError(exercise, values);
  const blocked = capped || !!valueError;
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
        <Text style={s.activeTarget}>
          {sets.length > 0 && type === 'weight_reps'
            ? `Logged: ${loggedWeightLine(sets)}`
            : `Target: ${targetLine(exercise)}`}
        </Text>
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
          {fields.map((f) => (
            <Text key={f} style={[s.th, s.colMid]}>{COLUMN_LABEL[f]}</Text>
          ))}
          <Text style={[s.th, s.colStatus]}>STATUS</Text>
        </View>

        {sets.map((st) => (
          <View key={st.setNumber} style={s.tableRowDone}>
            <Text style={[s.tdIndex, s.colSet]}>{st.setNumber}</Text>
            {fields.map((f) => (
              <Text key={f} style={[s.tdValue, s.colMid]}>{loggedCell(f, st)}</Text>
            ))}
            <View style={[s.colStatus, s.statusCell]}>
              {st.unsynced
                ? <MdbIcon name="refresh" size={14} color={MC.textTertiary} />
                : <MdbIcon name="check" size={16} color={MC.warm} />}
            </View>
          </View>
        ))}

        {/* Current set row — gone once the target is met. Leaving a row the
            member cannot submit reads as "one more to go" while the hint says
            the opposite. */}
        {!capped && (
        <View style={s.tableRowCurrent}>
          <View style={[s.colSet, s.currentIndexCell]}>
            <Animated.View style={{ opacity: pulse }}>
              <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.pulseDot} />
            </Animated.View>
            <Text style={s.tdIndexCurrent}>{setNumber}</Text>
          </View>

          {fields.map((f) => {
            const cell = INPUT_CELL[f];
            return (
              <View key={f} style={[s.colMid, s.inputCell]}>
                <TextInput
                  style={s.input}
                  value={{ reps, weight, time: timeText, distance: distText }[f]}
                  onChangeText={{ reps: onReps, weight: onWeight, time: onTime, distance: onDist }[f]}
                  keyboardType={cell.keyboard}
                  placeholder={cell.placeholder(exercise)}
                  placeholderTextColor={MC.textTertiary}
                  selectionColor={MC.violetLight}
                />
              </View>
            );
          })}

          <View style={[s.colStatus, s.statusCell]}>
            <TouchableOpacity onPress={onLog} activeOpacity={0.85} disabled={blocked}>
              <LinearGradient
                colors={MG.primary}
                start={MG.start}
                end={MG.end}
                style={[s.logBtn, blocked && s.logBtnDisabled]}
              >
                <MdbIcon name="check-bold" size={16} color={MC.white} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
        )}
      </View>

      {/* ── Action chips ───────────────────────────────────────────────── */}
      <View style={s.chipRow}>
        <View style={s.addSet}>
          <Text style={[s.addSetHint, !capped && !!valueError && s.addSetHintWarn]}>
            {capped
              ? `Target reached (${totalTarget} of ${totalTarget})`
              : valueError || `Set ${setNumber}${totalTarget ? ` of ${totalTarget}` : ''}`}
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

/* ── Measurement-driven table columns ────────────────────────────────────── */

const COLUMN_LABEL = { reps: 'REPS', weight: 'KG', time: 'TIME', distance: 'KM' };

const INPUT_CELL = {
  reps: { keyboard: 'number-pad', placeholder: (ex) => str(ex.targetReps) },
  // Bodyweight prompts with a dash rather than an empty box, so leaving it
  // blank reads as a deliberate "no added load" rather than an oversight.
  weight: {
    keyboard: 'decimal-pad',
    placeholder: (ex) => (ex.equipmentType === 'bodyweight' ? '—' : str(ex.targetWeight)),
  },
  time: { keyboard: 'numbers-and-punctuation', placeholder: () => 'mm:ss' },
  distance: { keyboard: 'decimal-pad', placeholder: () => 'km' },
};

const loggedCell = (field, st) => {
  switch (field) {
    case 'reps': return st.actualReps ?? '—';
    case 'weight': return st.actualWeight == null ? 'BW' : fmtKg(st.actualWeight);
    case 'time': return st.actualTimeSeconds != null ? secondsToMmss(st.actualTimeSeconds) : '—';
    case 'distance': return st.actualDistance != null ? String(metersToKm(st.actualDistance)) : '—';
    default: return '—';
  }
};

/** Empty string / null → '' so a TextInput never renders the text "null". */
const str = (v) => (v == null ? '' : String(v));

const num = (v) => {
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
};

/**
 * Only the fields this exercise actually measures get sent.
 *
 * Weight is null rather than 0 when the box is blank — the two mean very
 * different things. 0 kg is a claim that nothing was on the bar; null means
 * no load applies, which is the honest answer for a bodyweight movement and
 * keeps it out of total_volume instead of dragging tonnage down.
 */
const valuesFor = (exercise, { reps, weight, timeText, distText }) => {
  switch (exercise?.measurementType) {
    case 'reps': return { actualReps: num(reps) };
    case 'time': return { actualTimeSeconds: timeText ? mmssToSeconds(timeText) : null };
    case 'distance': return { actualDistance: distText ? kmToMeters(distText) : null };
    default: return { actualReps: num(reps), actualWeight: num(weight) };
  }
};

/**
 * Mirror of the server's own check (setValueTypeError in the backend's
 * workoutMath), so the button explains itself before the request rather than
 * after a 400. Bodyweight is the deliberate exception to "no zero weight".
 */
const setValueError = (exercise, values) => {
  const type = exercise?.measurementType || 'weight_reps';
  if (type === 'time') return values.actualTimeSeconds > 0 ? null : 'Enter a time';
  if (type === 'distance') return values.actualDistance > 0 ? null : 'Enter a distance';
  if (!(values.actualReps >= 1)) return 'Enter your reps';
  if (type === 'weight_reps' && exercise?.equipmentType !== 'bodyweight'
      && !(values.actualWeight > 0)) {
    return 'Enter the weight you lifted';
  }
  return null;
};

const fmtKg = (v) => (v == null ? '—' : Number(v).toFixed(1));

const uniqueWeights = (sets) => {
  const ws = sets.map((st) => st.actualWeight).filter((w) => w != null);
  // Reachable at last: the screen used to coerce a blank weight box to 0, so
  // a bodyweight set was stored as a genuine 0 kg and never took this branch.
  if (!ws.length) return 'Bodyweight';
  return `${[...new Set(ws)].join(', ')} kg`;
};

/**
 * What the member actually lifted, grouped — "3 x 2.5 kg" when every set
 * matched, "2 x 2.5 kg · 1 x 5 kg" when they did not.
 *
 * The active card used to show only the prescription, so a card reading
 * "Target: 3 sets @ 0 kg" sat above a table of real 2.5 kg sets. Once
 * anything is logged, what happened is the more useful thing to show.
 */
const loggedWeightLine = (sets) => {
  const groups = [];
  for (const st of sets) {
    const w = st.actualWeight == null ? null : Number(st.actualWeight);
    const last = groups[groups.length - 1];
    if (last && last.w === w) last.n += 1;
    else groups.push({ w, n: 1 });
  }
  // Same weight throughout collapses to one term regardless of order.
  const distinct = [...new Set(groups.map((g) => g.w))];
  if (distinct.length === 1) {
    const w = distinct[0];
    return `${sets.length} × ${w == null || w === 0 ? 'Bodyweight' : `${trimKg(w)} kg`}`;
  }
  return groups
    .map((g) => `${g.n} × ${g.w == null || g.w === 0 ? 'Bodyweight' : `${trimKg(g.w)} kg`}`)
    .join(' · ');
};

/** 2.50 -> "2.5", 5.00 -> "5" — the pack never shows trailing zeros. */
const trimKg = (n) => String(Number(n));

/** What a finished exercise reads as once collapsed, per measurement type. */
const loggedSummary = (exercise, sets) => {
  switch (exercise?.measurementType) {
    case 'time':
      return sets.map((st) => secondsToMmss(st.actualTimeSeconds)).join(' · ');
    case 'distance':
      return sets.map((st) => `${metersToKm(st.actualDistance)} km`).join(' · ');
    case 'reps':
      return `${sets.length} × ${sets.map((st) => st.actualReps ?? '—').join(', ')}`;
    default:
      return `${sets.length} × ${sets.map((st) => st.actualReps ?? '—').join(', ')} @ ${uniqueWeights(sets)}`;
  }
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
  logBtnDisabled: { opacity: 0.35 },

  /* Chips */
  chipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -4 },
  addSet: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addSetHint: { fontFamily: MF.medium, fontSize: 11, color: MC.textTertiary },
  addSetHintWarn: { color: MC.warm },
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
