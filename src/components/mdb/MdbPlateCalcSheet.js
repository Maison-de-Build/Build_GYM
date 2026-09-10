/**
 * Screen 04 — Barbell Plate Calculator bottom sheet.
 * Port of `screen_04_plate_calculator.html`.
 *
 * 464px sheet on a #111114 ground with a 36×4 handle, a 28px tabular hero
 * target, a ±2.5 kg stepper, the top-down barbell diagram (plates stacked
 * outward from the collars, sized and coloured to gym standard) and the
 * configuration summary with its exact-match / closest-achievable badge.
 *
 * Math comes from utils/plateCalc.js, which mirrors the backend's computePlates
 * — this sheet only draws it.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';

import { MC, MF, MR } from '../../theme/mdbKit';
import MdbIcon from './MdbIcon';
import {
  computePlates, summarizePlates, resolveBarWeight, DEFAULT_BAR_KG,
} from '../../utils/plateCalc';
import { fetchPlateSettings } from '../../services/workoutService';

// Gym-standard colour + physical size per denomination, straight from the pack.
const PLATE_STYLE = {
  25:   { width: 14, height: 28, bg: '#DC2626', fg: '#FFFFFF' },
  20:   { width: 13, height: 26, bg: '#2563EB', fg: '#FFFFFF' },
  15:   { width: 11, height: 24, bg: '#EAB308', fg: '#000000' },
  10:   { width: 10, height: 22, bg: '#16A34A', fg: '#FFFFFF' },
  5:    { width: 8,  height: 18, bg: '#F1F2F3', fg: '#000000', border: 'rgba(0,0,0,0.2)' },
  2.5:  { width: 6,  height: 15, bg: '#8E828D', fg: '#FFFFFF' },
  1.25: { width: 4,  height: 12, bg: '#8E828D', fg: '#FFFFFF' },
};

export default function MdbPlateCalcSheet({ exercise, targetWeight, onClose }) {
  const open = !!exercise;
  const [memberBar, setMemberBar] = useState(DEFAULT_BAR_KG);
  const [target, setTarget] = useState(Number(targetWeight) || 0);

  useEffect(() => {
    if (open) setTarget(Number(targetWeight) || Number(exercise?.targetWeight) || DEFAULT_BAR_KG);
  }, [open, targetWeight, exercise?.targetWeight]);

  // Member's remembered default bar (server is source of truth; falls back to 20).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchPlateSettings()
      .then((r) => { if (alive && r?.defaultBarWeightKg != null) setMemberBar(Number(r.defaultBarWeightKg)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [open]);

  if (!open) return null;

  const bar = resolveBarWeight(exercise?.barWeightOverrideKg, memberBar);
  const result = computePlates(target, bar);
  const grouped = summarizePlates(result.perSide);

  const sideLabel = result.justBar
    ? 'Bare bar'
    : grouped.map((g) => `${g.count} × ${g.kg} kg`).join(' + ');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={s.handleHit}>
            <View style={s.handle} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 0 }}>
            {/* Header */}
            <View style={s.head}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>Plate Loading</Text>
                <Text style={s.subtitle} numberOfLines={1}>{exercise?.name}</Text>
              </View>
              <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7} hitSlop={8}>
                <MdbIcon name="x" size={14} color={MC.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Hero target + stepper */}
            <View style={s.heroRow}>
              <View>
                <View style={s.heroLine}>
                  <Text style={s.heroValue}>{trimNum(target)} kg</Text>
                  <Text style={s.heroLabel}>Target</Text>
                </View>
                <Text style={s.barCaption}>
                  Bar: {trimNum(bar)} kg{bar === 20 ? ' (Olympic Standard)' : ''}
                </Text>
              </View>

              <View style={s.stepper}>
                <TouchableOpacity
                  style={s.stepBtn}
                  onPress={() => setTarget((w) => Math.max(0, round2(w - 2.5)))}
                  activeOpacity={0.75}
                >
                  <Text style={s.stepText}>−</Text>
                </TouchableOpacity>
                <Text style={s.stepUnit}>2.5kg</Text>
                <TouchableOpacity
                  style={s.stepBtn}
                  onPress={() => setTarget((w) => round2(w + 2.5))}
                  activeOpacity={0.75}
                >
                  <Text style={s.stepText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Top-down barbell diagram */}
            <View style={s.diagramCard}>
              <Text style={s.diagramTitle}>Top-Down Loading Configuration</Text>

              <View style={s.diagram}>
                <View style={s.barLine} />
                <View style={s.knurling} />

                {/* Left sleeve: plates stack outward, so heaviest sits by the collar */}
                <View style={s.leftStack}>
                  {[...result.perSide].map((p, i) => <Plate key={`l${i}`} kg={p} />)}
                </View>
                <View style={s.leftCollar} />

                <View style={s.rightCollar} />
                <View style={s.rightStack}>
                  {[...result.perSide].map((p, i) => <Plate key={`r${i}`} kg={p} />)}
                </View>
              </View>

              <View style={s.diagramLabels}>
                <Text style={s.diagramSide} numberOfLines={1}>{sideLabel}</Text>
                <Text style={s.diagramShaft}>← SHAFT →</Text>
                <Text style={s.diagramSide} numberOfLines={1}>{sideLabel}</Text>
              </View>
            </View>

            {/* Breakdown + edge-case badge */}
            <View style={s.summaryCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.summaryLabel}>Configuration</Text>
                <Text style={s.summaryValue} numberOfLines={2}>
                  {result.justBar ? 'Bare bar — no plates needed' : `Each side: ${sideLabel}`}
                </Text>
              </View>
              <View style={[s.badge, !result.exact && s.badgeWarn]}>
                <Text style={[s.badgeText, !result.exact && s.badgeTextWarn]}>
                  {result.exact ? 'Exact Match' : `Closest ${trimNum(result.achievableKg)} kg`}
                </Text>
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity style={s.confirm} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.confirmText}>Confirm Load</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Plate({ kg }) {
  const st = PLATE_STYLE[kg] || PLATE_STYLE[1.25];
  return (
    <View
      style={{
        width: st.width,
        height: st.height,
        backgroundColor: st.bg,
        borderRadius: 2,
        borderWidth: st.border ? 1 : 0,
        borderColor: st.border,
      }}
    />
  );
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const trimNum = (n) => (Number.isInteger(Number(n)) ? String(Number(n)) : String(round2(Number(n))));

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.60)', justifyContent: 'flex-end' },
  sheet: {
    height: 464,
    backgroundColor: '#111114',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    padding: 20,
    justifyContent: 'space-between',
  },
  handleHit: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 24, marginBottom: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' },

  head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontFamily: MF.semibold, fontSize: 16, color: MC.text, letterSpacing: -0.2 },
  subtitle: { fontFamily: MF.medium, fontSize: 13, color: MC.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },

  heroRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: MC.cardBorder,
    paddingBottom: 14, marginBottom: 20,
  },
  heroLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroValue: {
    fontFamily: MF.monoSemi, fontSize: 28, color: MC.text,
    fontVariant: ['tabular-nums'], letterSpacing: -0.5,
  },
  heroLabel: {
    fontFamily: MF.medium, fontSize: 12, color: MC.textTertiary,
    textTransform: 'uppercase',
  },
  barCaption: { fontFamily: MF.mono, fontSize: 11, color: MC.textTertiary, marginTop: 2 },

  stepper: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: MC.cardBorder,
    borderRadius: 8, padding: 4,
  },
  stepBtn: {
    width: 28, height: 28, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepText: { fontFamily: MF.bold, fontSize: 14, color: MC.textSecondary },
  stepUnit: { fontFamily: MF.mono, fontSize: 10, color: MC.textTertiary, paddingHorizontal: 4 },

  diagramCard: {
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder,
    borderRadius: MR.card, padding: 16, marginBottom: 12, overflow: 'hidden',
  },
  diagramTitle: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.textTertiary,
    textAlign: 'center', marginBottom: 12,
  },
  diagram: { height: 64, alignItems: 'center', justifyContent: 'center' },
  barLine: {
    position: 'absolute', height: 3, width: '85%',
    backgroundColor: 'rgba(185,178,186,0.4)', borderRadius: 2,
  },
  knurling: {
    position: 'absolute', width: 80, height: 7,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2,
    borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },
  leftStack: {
    position: 'absolute', right: '50%', marginRight: 45,
    flexDirection: 'row-reverse', alignItems: 'center', gap: 2,
  },
  rightStack: {
    position: 'absolute', left: '50%', marginLeft: 45,
    flexDirection: 'row', alignItems: 'center', gap: 2,
  },
  leftCollar: {
    position: 'absolute', right: '50%', marginRight: 40,
    width: 5, height: 26, backgroundColor: MC.textSecondary, borderRadius: 2,
  },
  rightCollar: {
    position: 'absolute', left: '50%', marginLeft: 40,
    width: 5, height: 26, backgroundColor: MC.textSecondary, borderRadius: 2,
  },
  diagramLabels: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingTop: 8, gap: 8,
  },
  diagramSide: { flex: 1, fontFamily: MF.mono, fontSize: 10, color: MC.textTertiary },
  diagramShaft: { fontFamily: MF.regular, fontSize: 9, color: 'rgba(185,178,186,0.5)' },

  summaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: MC.card, borderWidth: 1, borderColor: MC.cardBorder,
    borderRadius: MR.card, paddingHorizontal: 14, paddingVertical: 10,
  },
  summaryLabel: {
    fontFamily: MF.regular, fontSize: 10, letterSpacing: 1,
    textTransform: 'uppercase', color: MC.textTertiary,
  },
  summaryValue: { fontFamily: MF.medium, fontSize: 13, color: MC.textSecondary, marginTop: 2 },
  badge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: MR.xs,
    backgroundColor: 'rgba(52,211,153,0.10)',
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.30)',
  },
  badgeWarn: {
    backgroundColor: 'rgba(245,166,35,0.10)',
    borderColor: 'rgba(245,166,35,0.30)',
  },
  badgeText: { fontFamily: MF.semibold, fontSize: 11, color: MC.fresh },
  badgeTextWarn: { color: MC.warm },

  confirm: {
    height: 42, borderRadius: MR.button,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  confirmText: {
    fontFamily: MF.semibold, fontSize: 13, letterSpacing: 1.2,
    textTransform: 'uppercase', color: MC.text,
  },
});
