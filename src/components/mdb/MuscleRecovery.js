/**
 * MuscleRecoveryStrip + MuscleDetailSheet — the horizontal readiness chips that
 * sit at the bottom of screens 01 / 02, and the bottom sheet a chip opens.
 *
 * PRD A.7 copy rule: status labels only ("Fresh" / "Moderate" / "Worked").
 * Never phrased as advice ("you should rest chest") — the sheet states the
 * score, when the muscle was last trained and its 72h volume, and stops there.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MC, MG, MF, MR, RECOVERY, recoveryStatus } from '../../theme/mdbKit';
import MdbIcon from './MdbIcon';

/* ── Chip rail ───────────────────────────────────────────────────────────── */
export function MuscleRecoveryStrip({ muscles = [], onSelect }) {
  if (!muscles.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.rail}
    >
      {muscles.map((m) => {
        const key = m.status || recoveryStatus(m.score);
        const { color } = RECOVERY[key] || RECOVERY.fresh;
        return (
          <TouchableOpacity
            key={m.muscleGroup}
            style={s.chip}
            activeOpacity={0.85}
            onPress={() => onSelect?.(m)}
          >
            <View style={[s.chipDot, { backgroundColor: color, shadowColor: color }]} />
            <Text style={s.chipName}>{String(m.muscleGroup).replace(/_/g, ' ')}</Text>
            <Text style={s.chipPct}>{Math.round(m.score)}%</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/* ── Detail bottom sheet (compact form of screen 20) ─────────────────────── */
export function MuscleDetailSheet({ muscle, onClose }) {
  const open = !!muscle;
  const key = muscle ? (muscle.status || recoveryStatus(muscle.score)) : 'fresh';
  const meta = RECOVERY[key] || RECOVERY.fresh;
  const score = muscle ? Math.round(muscle.score) : 0;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={s.grab} />

          <View style={s.sheetHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetEyebrow}>RECOVERY DETAIL</Text>
              <Text style={s.sheetTitle}>
                {muscle ? `${titleCase(muscle.muscleGroup)} Recovery Detail` : ''}
              </Text>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7} hitSlop={8}>
              <MdbIcon name="x" size={14} color={MC.textTertiary} />
            </TouchableOpacity>
          </View>

          <View style={s.card}>
            <View style={s.cardRow}>
              <Text style={s.cardLabel}>Muscle State:</Text>
              <Text style={[s.cardValue, { color: meta.color }]}>
                {meta.label} ({score}% Recovered)
              </Text>
            </View>

            <View style={s.track}>
              <LinearGradient
                colors={MG.primary}
                start={MG.startX}
                end={MG.endX}
                style={[s.fill, { width: `${Math.max(0, Math.min(100, score))}%` }]}
              />
            </View>

            <View style={s.cardRow}>
              <Text style={s.cardMeta}>
                {muscle?.lastTrainedLabel ? `Last trained: ${muscle.lastTrainedLabel}` : 'Not trained recently'}
              </Text>
              {muscle?.fullRecoveryLabel ? (
                <Text style={s.cardMeta}>Full recovery: {muscle.fullRecoveryLabel}</Text>
              ) : null}
            </View>
          </View>

          {muscle?.volume72h != null && (
            <View style={s.noteBox}>
              <Text style={s.noteTitle}>72-hour volume</Text>
              <Text style={s.noteBody}>
                {Number(muscle.volume72h).toLocaleString()} kg attributed to this muscle group
                {muscle.sessionCount72h != null ? ` across ${muscle.sessionCount72h} session${muscle.sessionCount72h === 1 ? '' : 's'}` : ''}.
              </Text>
            </View>
          )}

          <TouchableOpacity style={s.dismiss} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.dismissText}>Dismiss Sheet</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const titleCase = (v) =>
  String(v || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const s = StyleSheet.create({
  rail: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: MC.card,
    borderWidth: 1,
    borderColor: MC.cardBorder,
    borderRadius: MR.card,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOpacity: 0.5,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
  chipName: {
    fontFamily: MF.semibold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: MC.text,
  },
  chipPct: { fontFamily: MF.mono, fontSize: 9, color: MC.textTertiary, fontVariant: ['tabular-nums'] },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.70)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0E0B13',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 36,
    gap: 16,
  },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.20)', alignSelf: 'center' },

  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sheetEyebrow: {
    fontFamily: MF.semibold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: MC.textTertiary,
  },
  sheetTitle: { fontFamily: MF.semibold, fontSize: 18, color: MC.text, marginTop: 2 },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    backgroundColor: MC.card,
    borderWidth: 1,
    borderColor: MC.cardBorder,
    borderRadius: MR.card,
    padding: 14,
    gap: 8,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { fontFamily: MF.regular, fontSize: 12, color: MC.textSecondary },
  cardValue: { fontFamily: MF.medium, fontSize: 12 },
  cardMeta: { fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary },

  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },

  noteBox: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
  },
  noteTitle: { fontFamily: MF.medium, fontSize: 12, color: MC.text, marginBottom: 4 },
  noteBody: { fontFamily: MF.regular, fontSize: 12, color: MC.textSecondary, lineHeight: 18 },

  dismiss: {
    height: 40,
    borderRadius: MR.button,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    fontFamily: MF.semibold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: MC.text,
  },
});

export default MuscleRecoveryStrip;
