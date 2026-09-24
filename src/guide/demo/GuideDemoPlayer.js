/**
 * Demo: the workout player — logging the first set.
 *
 * Mirrors the real session screen: the SET / KG / REPS / STATUS table, fields
 * already carrying the target, the gradient tick that marks a set done, and the
 * rest timer that appears afterwards with its draining bar and 15-second
 * adjusters. Marking the set here changes nothing outside this screen.
 *
 * Fields start prefilled because the real player does — it seeds from the last
 * logged set, falling back to the target. Teaching empty boxes would be teaching
 * the wrong screen.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { MC, MG, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import { GradientRing } from '../../components/mdb/MdbPrimitives';
import DemoScaffold from './DemoScaffold';
import GuideTarget from '../GuideTarget';
import { T } from '../targets';
import { DEMO_BANNER } from '../copy';
import { DEMO_TEMPLATE } from './demoData';

const REST_TOTAL = 90;
const exercise = DEMO_TEMPLATE.exercises[0];

export default function GuideDemoPlayer() {
  const [weight, setWeight] = useState(String(exercise.targetWeight));
  const [reps, setReps] = useState(String(exercise.targetReps));
  const [logged, setLogged] = useState(false);
  const [rest, setRest] = useState(null);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.45, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // The demo timer counts but never runs out on its own: the guide decides when
  // the rest step ends, and a timer expiring mid-sentence would pull the
  // highlight out from under the member.
  useEffect(() => {
    if (rest == null || rest <= 1) return undefined;
    const t = setTimeout(() => setRest((r) => (r == null ? r : r - 1)), 1000);
    return () => clearTimeout(t);
  }, [rest]);

  const logSet = () => {
    if (logged) return;
    setLogged(true);
    setRest(REST_TOTAL);
  };

  const mmss = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

  return (
    <DemoScaffold label={DEMO_BANNER.workout}>
      <View style={s.topBar}>
        <Text style={s.topTitle} numberOfLines={1}>{DEMO_TEMPLATE.name}</Text>
        <Text style={s.clock}>12:04</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.activeCard}>
          <LinearGradient colors={MG.primary} start={MG.startY} end={MG.endY} style={s.edge} />

          <View style={s.head}>
            <GradientRing size={28}><Text style={s.letter}>A</Text></GradientRing>
            <Text style={s.exName} numberOfLines={1}>{exercise.name}</Text>
            <View style={s.badge}><Text style={s.badgeText}>Active</Text></View>
          </View>

          <Text style={s.target}>
            Target: {exercise.sets} sets @ {exercise.targetWeight} kg × {exercise.targetReps}
          </Text>

          <View style={s.table}>
            <View style={s.tableHead}>
              <Text style={[s.th, s.colSet]}>SET</Text>
              <Text style={[s.th, s.colMid]}>KG</Text>
              <Text style={[s.th, s.colMid]}>REPS</Text>
              <Text style={[s.th, s.colStatus]}>STATUS</Text>
            </View>

            {logged && (
              <View style={s.rowDone}>
                <Text style={[s.tdIndex, s.colSet]}>1</Text>
                <Text style={[s.td, s.colMid]}>{weight}</Text>
                <Text style={[s.td, s.colMid]}>{reps}</Text>
                <View style={[s.colStatus, s.statusCell]}>
                  <MdbIcon name="check" size={16} color={MC.warm} />
                </View>
              </View>
            )}

            {!logged && (
              <GuideTarget id={T.DW_SET_FIELDS}>
                <View style={s.rowCurrent}>
                  <View style={[s.colSet, s.indexCell]}>
                    <Animated.View style={{ opacity: pulse }}>
                      <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.dot} />
                    </Animated.View>
                    <Text style={s.tdIndexCurrent}>1</Text>
                  </View>
                  <View style={[s.colMid, s.inputCell]}>
                    <TextInput
                      style={s.input} value={weight} onChangeText={setWeight}
                      keyboardType="decimal-pad" selectionColor={MC.violetLight}
                    />
                  </View>
                  <View style={[s.colMid, s.inputCell]}>
                    <TextInput
                      style={s.input} value={reps} onChangeText={setReps}
                      keyboardType="number-pad" selectionColor={MC.violetLight}
                    />
                  </View>
                  <View style={[s.colStatus, s.statusCell]}>
                    <GuideTarget id={T.DW_LOG_SET}>
                      <TouchableOpacity onPress={logSet} activeOpacity={0.85}>
                        <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.logBtn}>
                          <MdbIcon name="check-bold" size={16} color={MC.white} />
                        </LinearGradient>
                      </TouchableOpacity>
                    </GuideTarget>
                  </View>
                </View>
              </GuideTarget>
            )}
          </View>

          <Text style={s.hint}>{logged ? 'Set 2 of 3' : 'Set 1 of 3'}</Text>

          {rest != null && (
            <GuideTarget id={T.DW_REST}>
              <View style={s.restBlock}>
                <View style={s.restTrack}>
                  <LinearGradient
                    colors={MG.primary} start={MG.startX} end={MG.endX}
                    style={[s.restFill, { width: `${(rest / REST_TOTAL) * 100}%` }]}
                  />
                </View>
                <View style={s.restRow}>
                  <View style={s.restAdjust}><Text style={s.restAdjustText}>−15s</Text></View>
                  <View style={s.restCenter}>
                    <MdbIcon name="clock" size={12} color={MC.cyan} />
                    <Text style={s.restTime}>{mmss(rest)}</Text>
                    <Text style={s.restLabel}>REST</Text>
                  </View>
                  <View style={s.restAdjust}><Text style={s.restAdjustText}>+15s</Text></View>
                </View>
              </View>
            </GuideTarget>
          )}
        </View>

        {DEMO_TEMPLATE.exercises.slice(1).map((ex, i) => (
          <View key={ex.id} style={s.upcoming}>
            <Text style={s.upcomingLetter}>{String.fromCharCode(66 + i)}</Text>
            <Text style={s.upcomingName} numberOfLines={1}>{ex.name}</Text>
            <Text style={s.upcomingSets}>{ex.sets} × {ex.targetReps}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={s.bottomBar}>
        <Text style={s.progress}>{logged ? '0 of 3 done' : '0 of 3 done'}</Text>
        <GuideTarget id={T.DW_FINISH}>
          <TouchableOpacity activeOpacity={0.9}>
            <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.finishBtn}>
              <Text style={s.finishText}>FINISH WORKOUT</Text>
            </LinearGradient>
          </TouchableOpacity>
        </GuideTarget>
      </View>
    </DemoScaffold>
  );
}

const s = StyleSheet.create({
  topBar: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: MS.hMargin,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  topTitle: { flex: 1, fontFamily: MF.semibold, fontSize: 15, color: MC.text },
  clock: { fontFamily: MF.mono, fontSize: 14, color: MC.cyan, fontVariant: ['tabular-nums'] },

  scroll: { padding: MS.hMargin, gap: 10 },
  activeCard: {
    padding: 16, borderRadius: MR.card, overflow: 'hidden',
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder,
  },
  edge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  letter: { fontFamily: MF.bold, fontSize: 11, color: MC.white },
  exName: { flex: 1, fontFamily: MF.semibold, fontSize: 15, color: MC.text },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: MR.pill,
    backgroundColor: 'rgba(120,61,236,0.15)',
  },
  badgeText: { fontFamily: MF.medium, fontSize: 10, color: MC.violetLight },
  target: { fontFamily: MF.regular, fontSize: 12, color: MC.textTertiary, marginTop: 8 },

  table: { marginTop: 12 },
  tableHead: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: MC.cardBorder,
  },
  th: {
    fontFamily: MF.medium, fontSize: 9, letterSpacing: 1,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  colSet: { width: 44 },
  colMid: { flex: 1, textAlign: 'center' },
  colStatus: { width: 56, alignItems: 'center' },
  rowDone: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  rowCurrent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  td: { fontFamily: MF.medium, fontSize: 13, color: MC.textSecondary, textAlign: 'center' },
  tdIndex: { fontFamily: MF.medium, fontSize: 13, color: MC.textTertiary },
  tdIndexCurrent: { fontFamily: MF.semibold, fontSize: 13, color: MC.text },
  indexCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  inputCell: { paddingHorizontal: 4 },
  input: {
    height: 38, borderRadius: MR.sm, textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: MC.cardBorder,
    fontFamily: MF.semibold, fontSize: 14, color: MC.text, padding: 0,
  },
  statusCell: { alignItems: 'center', justifyContent: 'center' },
  logBtn: { width: 34, height: 34, borderRadius: MR.sm, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: MF.medium, fontSize: 11, color: MC.textTertiary, marginTop: 10 },

  restBlock: { marginTop: 14, gap: 8 },
  restTrack: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  restFill: { height: 3 },
  restRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  restAdjust: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: MR.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  restAdjustText: { fontFamily: MF.medium, fontSize: 11, color: MC.textSecondary },
  restCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  restTime: { fontFamily: MF.mono, fontSize: 14, color: MC.text, fontVariant: ['tabular-nums'] },
  restLabel: { fontFamily: MF.medium, fontSize: 9, letterSpacing: 1, color: MC.textTertiary },

  upcoming: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, opacity: 0.6,
    backgroundColor: MC.cardAlt, borderRadius: MR.card,
    borderWidth: 1, borderColor: MC.cardBorder,
  },
  upcomingLetter: { fontFamily: MF.bold, fontSize: 12, color: MC.textTertiary, width: 16 },
  upcomingName: { flex: 1, fontFamily: MF.medium, fontSize: 14, color: MC.textSecondary },
  upcomingSets: { fontFamily: MF.regular, fontSize: 12, color: MC.textTertiary },

  bottomBar: {
    paddingHorizontal: MS.hMargin, paddingTop: 12, paddingBottom: 24, gap: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', backgroundColor: MC.bg,
  },
  progress: { fontFamily: MF.medium, fontSize: 11, color: MC.textTertiary, textAlign: 'center' },
  finishBtn: { height: 46, borderRadius: MR.button, alignItems: 'center', justifyContent: 'center' },
  finishText: { fontFamily: MF.semibold, fontSize: 13, color: MC.white, letterSpacing: 1.2 },
});
