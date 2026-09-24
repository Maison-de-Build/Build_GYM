/**
 * GetStartedCard — the launcher for the three guides, at the top of Home.
 *
 * Which rows exist is not decided here: it comes from guideRules, the same
 * source Profile's replay list reads, so the two can never disagree about
 * whether this member has a coach row.
 *
 * Card styling follows Home's own cards (18px radius, hairline border) rather
 * than the 12px in the spec — "the existing card style" means the one used by
 * the cards it sits above, and 12px would read as a foreign element there.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { COLORS, FONTS } from '../../theme';
import { CARD } from '../../guide/copy';
import { eligibleGuides, guideProgress, isCardExhausted, shouldShowCard } from '../../guide/guideRules';

export default function GetStartedCard({ state, config, onDismiss, onStartGuide, style }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const rows = useMemo(() => eligibleGuides(config), [config]);
  const { done, total } = useMemo(() => guideProgress(state, config), [state, config]);
  const exhausted = useMemo(() => isCardExhausted(state, config), [state, config]);
  const visible = shouldShowCard(state, config);

  // "You're set." shows for the render on which the last row is cleared, then
  // never again. Dismissing it here is what makes that true: the next Home load
  // reads card_dismissed and skips the card entirely.
  useEffect(() => {
    if (visible && exhausted) onDismiss?.();
  }, [visible, exhausted, onDismiss]);

  if (!visible) return null;

  if (exhausted) {
    return (
      <View style={[s.card, style]}>
        <Text style={s.allDone}>{CARD.allDone}</Text>
      </View>
    );
  }

  return (
    <View style={[s.card, style]}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{CARD.title}</Text>
          <Text style={s.progress}>{CARD.progress(done, total)}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setSheetOpen(true)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Hide these guides"
        >
          <MaterialIcons name="close" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={s.rows}>
        {rows.map((key) => (
          <Row
            key={key}
            guideKey={key}
            status={state.guides?.[key]?.status || 'not_started'}
            hasCoach={config.hasCoach}
            onPress={() => onStartGuide?.(key)}
          />
        ))}
      </View>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable style={s.backdrop} onPress={() => setSheetOpen(false)}>
          {/* Stops a tap inside the sheet closing it through the backdrop. */}
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle}>{CARD.hideSheet.title}</Text>
            <Text style={s.sheetBody}>{CARD.hideSheet.body}</Text>
            <View style={s.sheetActions}>
              <TouchableOpacity style={s.sheetBtn} onPress={() => setSheetOpen(false)}>
                <Text style={s.sheetKeep}>{CARD.hideSheet.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.sheetBtn}
                onPress={() => { setSheetOpen(false); onDismiss?.(); }}
              >
                <Text style={s.sheetHide}>{CARD.hideSheet.confirm}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Row({ guideKey, status, hasCoach, onPress }) {
  const copy = CARD.rows[guideKey];
  if (!copy) return null;

  const dealtWith = status !== 'not_started';
  // A coached member never plans a workout, so the freestyle sub-line would
  // describe a step they will not be shown.
  const sub = guideKey === 'first_workout' && hasCoach && copy.subCoached
    ? copy.subCoached
    : copy.sub;

  return (
    <TouchableOpacity
      style={s.row}
      onPress={dealtWith ? undefined : onPress}
      disabled={dealtWith}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={copy.title}
      accessibilityState={{ disabled: dealtWith }}
    >
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTitle, dealtWith && s.dimmed]}>{copy.title}</Text>
        <Text style={[s.rowSub, dealtWith && s.dimmed]}>
          {status === 'skipped' ? CARD.skippedLabel : sub}
        </Text>
      </View>
      {status === 'completed' ? (
        <MaterialIcons name="check" size={18} color={COLORS.textMuted} />
      ) : status === 'skipped' ? null : (
        <MaterialIcons name="chevron-right" size={20} color={COLORS.textMuted} />
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    padding: 18,
    marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontFamily: FONTS.headline, fontSize: 16, color: COLORS.white },
  progress: {
    fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted, marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  allDone: { fontFamily: FONTS.headline, fontSize: 15, color: COLORS.white },

  rows: { marginTop: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  rowTitle: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.white },
  rowSub: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  dimmed: { opacity: 0.5 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', padding: 16 },
  sheet: {
    backgroundColor: '#1A1A2E', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    padding: 20, gap: 8,
  },
  sheetTitle: { fontFamily: FONTS.headline, fontSize: 16, color: COLORS.white },
  sheetBody: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, lineHeight: 19 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  sheetBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  sheetKeep: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.textMuted },
  sheetHide: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.primaryLight },
});
