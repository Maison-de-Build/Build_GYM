/**
 * MdbMonthPicker — the sheet behind the calendar's month header.
 *
 * The header used to be inert (a TouchableOpacity with no onPress), so no date
 * outside today−4…today+2 was reachable. This gives the month a real grid:
 * ‹ / › step months, each day shows the same amber dot / tick the strip uses,
 * and picking a day re-anchors the strip on it.
 *
 * The parent owns fetching — `onMonthChange` fires with the new month's ISO so
 * it can load that window before the grid paints.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { MC, MG, MF, MR } from '../../theme/mdbKit';
import MdbIcon from './MdbIcon';
import { monthGrid, monthTitle, shiftMonth, isoDate } from '../../utils/mdbWorkout';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function MdbMonthPicker({
  visible,
  monthIso,          // any ISO date inside the month being shown
  selectedIso,
  byDate,            // Map<iso, instances[]>
  loading = false,
  onMonthChange,
  onSelect,
  onClose,
}) {
  if (!visible) return null;

  const weeks = monthGrid(monthIso, byDate);
  const todayIso = isoDate(new Date());

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={s.grab} />

          {/* ── Month stepper ─────────────────────────────────────────────── */}
          <View style={s.head}>
            <TouchableOpacity
              style={s.navBtn}
              onPress={() => onMonthChange(shiftMonth(monthIso, -1))}
              activeOpacity={0.7}
              hitSlop={10}
              accessibilityLabel="Previous month"
            >
              <MdbIcon name="chevron-left" size={18} color={MC.textSecondary} />
            </TouchableOpacity>

            <View style={s.titleWrap}>
              <Text style={s.title}>{monthTitle(monthIso)}</Text>
              {loading && <ActivityIndicator size="small" color={MC.violetLight} />}
            </View>

            <TouchableOpacity
              style={s.navBtn}
              onPress={() => onMonthChange(shiftMonth(monthIso, 1))}
              activeOpacity={0.7}
              hitSlop={10}
              accessibilityLabel="Next month"
            >
              <MdbIcon name="chevron-right" size={18} color={MC.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* ── Weekday header ────────────────────────────────────────────── */}
          <View style={s.dowRow}>
            {DOW.map((d, i) => (
              <View key={i} style={s.cell}>
                <Text style={s.dow}>{d}</Text>
              </View>
            ))}
          </View>

          {/* ── Grid ──────────────────────────────────────────────────────── */}
          <View>
            {weeks.map((week, wi) => (
              <View key={wi} style={s.week}>
                {week.map((cell, ci) => {
                  if (!cell) return <View key={ci} style={s.cell} />;
                  const selected = cell.iso === selectedIso;
                  return (
                    <TouchableOpacity
                      key={ci}
                      style={s.cell}
                      activeOpacity={0.75}
                      onPress={() => onSelect(cell.iso)}
                      accessibilityLabel={`${cell.day} ${monthTitle(monthIso)}`}
                    >
                      {selected ? (
                        <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.bubble}>
                          <Text style={[s.day, s.daySelected]}>{cell.day}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={[s.bubble, cell.isToday && s.bubbleToday]}>
                          <Text style={[s.day, cell.isPast && s.dayPast]}>{cell.day}</Text>
                        </View>
                      )}

                      <View style={s.indicator}>
                        {cell.status === 'completed' ? (
                          <MdbIcon name="check" size={9} color={MC.warm} />
                        ) : cell.status === 'assigned' ? (
                          <View style={s.dot} />
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <View style={s.foot}>
            <TouchableOpacity onPress={() => { onMonthChange(todayIso); onSelect(todayIso); }} activeOpacity={0.7}>
              <Text style={s.today}>Jump to today</Text>
            </TouchableOpacity>
            <View style={s.legend}>
              <View style={s.legendItem}>
                <View style={s.dot} />
                <Text style={s.legendText}>Scheduled</Text>
              </View>
              <View style={s.legendItem}>
                <MdbIcon name="check" size={9} color={MC.warm} />
                <Text style={s.legendText}>Done</Text>
              </View>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.70)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0E0B13',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.20)', alignSelf: 'center' },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: MF.semibold, fontSize: 16, color: MC.text },

  dowRow: { flexDirection: 'row' },
  dow: {
    fontFamily: MF.semibold, fontSize: 10, letterSpacing: 1,
    color: MC.textTertiary, textAlign: 'center',
  },

  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  bubble: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  bubbleToday: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  day: {
    fontFamily: MF.monoMedium, fontSize: 13, color: MC.text,
    fontVariant: ['tabular-nums'],
  },
  daySelected: { color: MC.white, fontFamily: MF.monoSemi },
  dayPast: { color: MC.textTertiary },

  indicator: { height: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: MC.warm },

  foot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  today: { fontFamily: MF.semibold, fontSize: 12, color: MC.cyan },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontFamily: MF.regular, fontSize: 10, color: MC.textTertiary },
});
