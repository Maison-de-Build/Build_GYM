/**
 * Today's Workouts — the detail page behind Home's combined TODAY'S WORKOUT
 * summary card when more than one workout is scheduled for today (a
 * freestyle member picking a template + a custom exercise bundle, or several
 * templates in one day). Home shows one joined-name summary card so the
 * dashboard doesn't turn into a wall of cards; this screen is where each one
 * actually gets Begun/Resumed/viewed individually.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MC, MF, MS } from '../../theme/mdbKit';
import MdbIcon from '../../components/mdb/MdbIcon';
import WorkoutDayCard from '../../components/mdb/WorkoutDayCard';
import WorkoutEmptyState from '../../components/mdb/WorkoutEmptyState';
import useMemberMode from '../../hooks/useMemberMode';
import { fetchInstances } from '../../services/workoutService';
import { isoDate } from '../../utils/mdbWorkout';

export default function MdbTodaysWorkoutsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { isPt } = useMemberMode();
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchInstances();
      setInstances(data?.today || []);
    } catch {
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={MC.bg} />

      <View style={[s.topBar, { marginTop: insets.top }]}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MdbIcon name="chevron-left" size={20} color={MC.textSecondary} />
        </TouchableOpacity>
        <Text style={s.topTitle}>Today's Workouts</Text>
        <View style={s.iconBtn} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={MC.violetLight} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MC.violetLight} />}
        >
          {instances.length === 0 ? (
            <WorkoutEmptyState
              variant={isPt ? 'pt' : 'freestyle'}
              onAdd={() => navigation.navigate('MdbTemplateBrowser', { date: isoDate(new Date()) })}
            />
          ) : (
            instances.map((w) => (
              <WorkoutDayCard
                key={w.id}
                workout={w}
                onBegin={() => navigation.navigate('MdbActiveSession', { instanceId: w.id, instance: w })}
                onViewCompleted={() => navigation.navigate('MdbWorkoutSummary', { workoutLogId: w.id })}
              />
            ))
          )}
          <View style={{ height: MS.bottomRoom }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MC.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: MS.hMargin,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontFamily: MF.semibold, fontSize: 16, color: MC.text },
  scroll: { paddingHorizontal: MS.hMargin, paddingTop: 16, gap: 12 },
});
