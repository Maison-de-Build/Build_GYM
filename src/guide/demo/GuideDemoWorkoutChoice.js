/**
 * Demo: Choose a Workout — the two-tab picker, with one sample template.
 *
 * Mirrors the real screen's shape (Templates | Exercises, a sticky commit bar
 * reading "SCHEDULE 1 FOR TODAY") so what the member learns here is what they
 * will find. It deliberately does NOT offer a "build a template" path: no
 * member can create one, and a guide that taught it would send them looking for
 * a screen that does not exist.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { MC, MG, MF, MR, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import DemoScaffold from './DemoScaffold';
import GuideTarget from '../GuideTarget';
import { T } from '../targets';
import { DEMO_BANNER } from '../copy';
import { DEMO_TEMPLATE, DEMO_EXERCISES } from './demoData';

export default function GuideDemoWorkoutChoice() {
  const [tab, setTab] = useState('templates');
  const [picked, setPicked] = useState(false);

  return (
    <DemoScaffold label={DEMO_BANNER.workout}>
      <View style={s.topBar}>
        <Text style={s.topTitle}>Choose a Workout</Text>
      </View>

      <View style={s.segment}>
        <GuideTarget id={T.DW_TEMPLATE_TAB} style={s.segHalf}>
          <TouchableOpacity
            style={[s.segBtn, tab === 'templates' && s.segBtnOn]}
            onPress={() => setTab('templates')}
            activeOpacity={0.85}
          >
            <Text style={[s.segText, tab === 'templates' && s.segTextOn]}>Templates</Text>
          </TouchableOpacity>
        </GuideTarget>
        <GuideTarget id={T.DW_EXERCISE_TAB} style={s.segHalf}>
          <TouchableOpacity
            style={[s.segBtn, tab === 'exercises' && s.segBtnOn]}
            onPress={() => setTab('exercises')}
            activeOpacity={0.85}
          >
            <Text style={[s.segText, tab === 'exercises' && s.segTextOn]}>Exercises</Text>
          </TouchableOpacity>
        </GuideTarget>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'templates' ? (
          <GuideTarget id={T.DW_TEMPLATE_CARD}>
            <TouchableOpacity
              style={s.card}
              onPress={() => setPicked((p) => !p)}
              activeOpacity={0.85}
            >
              <View style={[s.tick, picked && s.tickOn]}>
                {picked && <MdbIcon name="check" size={12} color={MC.white} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.cardTitleRow}>
                  <Text style={s.cardTitle}>{DEMO_TEMPLATE.name}</Text>
                  <View style={s.tag}><Text style={s.tagText}>{DEMO_TEMPLATE.category}</Text></View>
                </View>
                <Text style={s.cardStats}>
                  {DEMO_TEMPLATE.exercises.length} exercises · {DEMO_TEMPLATE.estimatedMinutes} min
                </Text>
                <Text style={s.cardMuscles}>
                  {DEMO_TEMPLATE.exercises.map((e) => e.name).join(' · ')}
                </Text>
              </View>
            </TouchableOpacity>
          </GuideTarget>
        ) : (
          DEMO_EXERCISES.map((ex) => (
            <View key={ex.id} style={s.exRow}>
              <View style={s.tick} />
              <View style={{ flex: 1 }}>
                <Text style={s.exName}>{ex.name}</Text>
                <Text style={s.exGroup}>{ex.muscleGroup}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={s.commitBar}>
        <GuideTarget id={T.DW_SCHEDULE}>
          <TouchableOpacity activeOpacity={0.9}>
            <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.cta}>
              <Text style={s.ctaText}>SCHEDULE 1 FOR TODAY</Text>
            </LinearGradient>
          </TouchableOpacity>
        </GuideTarget>
      </View>
    </DemoScaffold>
  );
}

const s = StyleSheet.create({
  topBar: {
    height: 44, alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  topTitle: { fontFamily: MF.semibold, fontSize: 16, color: MC.text, letterSpacing: -0.2 },

  segment: { flexDirection: 'row', gap: 8, paddingHorizontal: MS.hMargin, paddingVertical: 12 },
  segHalf: { flex: 1 },
  segBtn: {
    height: 36, borderRadius: MR.button, alignItems: 'center', justifyContent: 'center',
    backgroundColor: MC.cardAlt, borderWidth: 1, borderColor: MC.cardBorder,
  },
  segBtnOn: { backgroundColor: MC.violet, borderColor: MC.violet },
  segText: { fontFamily: MF.medium, fontSize: 13, color: MC.textSecondary },
  segTextOn: { color: MC.white, fontFamily: MF.semibold },

  scroll: { paddingHorizontal: MS.hMargin, paddingTop: 4, gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder, borderRadius: MR.card,
  },
  tick: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: MC.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  tickOn: { backgroundColor: MC.violet, borderColor: MC.violet },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitle: { fontFamily: MF.semibold, fontSize: 15, color: MC.text },
  tag: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: MR.xs,
    borderWidth: 1, borderColor: 'rgba(120,61,236,0.6)', backgroundColor: 'rgba(120,61,236,0.1)',
  },
  tagText: {
    fontFamily: MF.semibold, fontSize: 9, letterSpacing: 0.8,
    textTransform: 'uppercase', color: MC.violetLight,
  },
  cardStats: { fontFamily: MF.medium, fontSize: 12, color: MC.textSecondary, marginTop: 6 },
  cardMuscles: { fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary, marginTop: 4 },

  exRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder, borderRadius: MR.card,
  },
  exName: { fontFamily: MF.medium, fontSize: 14, color: MC.text },
  exGroup: { fontFamily: MF.regular, fontSize: 11, color: MC.textTertiary, marginTop: 2 },

  commitBar: {
    paddingHorizontal: MS.hMargin, paddingTop: 12, paddingBottom: 24,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', backgroundColor: MC.bg,
  },
  cta: { height: 46, borderRadius: MR.button, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: MF.semibold, fontSize: 13, color: MC.white, letterSpacing: 1.2 },
});
