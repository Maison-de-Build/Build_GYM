/**
 * MdbTrainingHubScreen — the single entry point behind the dashboard's Training
 * tile. It resolves the member's mode once and renders the right calendar:
 *
 *   trainer-assigned → screen 01 (MdbWorkoutCalendarScreen)
 *   freestyle        → screen 02 (MdbFreestyleCalendarScreen)
 *
 * Resolving here rather than inside each screen keeps the mode check in one
 * place — the same split the pack applies to nutrition (07) and the template
 * browser (10), which the backend already gates at 403.
 */
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { MC } from '../../theme/mdbKit';
import useMemberMode from '../../hooks/useMemberMode';
import MdbWorkoutCalendarScreen from './MdbWorkoutCalendarScreen';
import MdbFreestyleCalendarScreen from './MdbFreestyleCalendarScreen';

export default function MdbTrainingHubScreen(props) {
  const { mode, loading } = useMemberMode();

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={MC.violetLight} />
      </View>
    );
  }

  return mode === 'pt'
    ? <MdbWorkoutCalendarScreen {...props} />
    : <MdbFreestyleCalendarScreen {...props} />;
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: MC.bg, alignItems: 'center', justifyContent: 'center' },
});
