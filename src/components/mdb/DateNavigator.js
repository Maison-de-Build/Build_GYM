/**
 * DateNavigator — the pack's fixed 7-day strip (screens 01 / 02).
 *
 * Does not scroll with the page: it is pinned under the month header and the
 * content scrolls beneath it. One cell per day:
 *   · day abbreviation  10px semibold, tracked, uppercase
 *   · 36px date bubble  16px semibold tabular figures; today fills with the
 *                       violet→cyan gradient
 *   · 16px indicator    amber tick when that day's workout is completed,
 *                       6px amber dot when one is assigned, empty on rest days
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MC, MG, MF } from '../../theme/mdbKit';
import MdbIcon from './MdbIcon';

export default function DateNavigator({ days, selectedKey, onSelect }) {
  return (
    <View style={s.wrap}>
      <View style={s.row}>
        {days.map((d) => {
          const selected = d.key === selectedKey;
          return (
            <TouchableOpacity
              key={d.key}
              style={s.cell}
              onPress={() => onSelect(d)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${d.label} ${d.date}`}
            >
              <Text style={[s.dayLabel, (selected || d.isToday) && s.dayLabelOn]}>{d.label}</Text>

              {d.isToday ? (
                <LinearGradient colors={MG.primary} start={MG.start} end={MG.end} style={s.bubble}>
                  <Text style={[s.dateText, s.dateTextToday]}>{d.date}</Text>
                </LinearGradient>
              ) : (
                <View style={[s.bubble, selected && s.bubbleSelected]}>
                  <Text style={s.dateText}>{d.date}</Text>
                </View>
              )}

              <View style={s.indicator}>
                {d.status === 'completed' ? (
                  <MdbIcon name="check" size={12} color={MC.warm} />
                ) : d.status === 'assigned' ? (
                  <View style={s.dot} />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingBottom: 12,
    backgroundColor: MC.bg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    gap: 4,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 12,
  },
  dayLabel: {
    fontFamily: MF.semibold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: MC.textTertiary,
    marginBottom: 4,
  },
  dayLabelOn: { color: MC.text },

  bubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleSelected: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  dateText: {
    fontFamily: MF.monoSemi,
    fontSize: 16,
    color: MC.text,
    fontVariant: ['tabular-nums'],
  },
  dateTextToday: { color: MC.white },

  indicator: { height: 16, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: MC.warm },
});
