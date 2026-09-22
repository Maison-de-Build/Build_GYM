/**
 * useWorkoutActions — the Edit / Remove affordances on a scheduled workout,
 * in one place because Home, Today's Workouts and the Training calendar all
 * render the same card and must agree on who may change what.
 *
 * The rule: only a workout the member added themselves, and only before it
 * has been started. A trainer's programming is theirs, and a session that is
 * underway or finished is a record rather than a plan. The backend enforces
 * the same two conditions — this just avoids offering an action that would
 * be refused.
 *
 * Pass the props straight through to WorkoutDayCard; when a workout isn't
 * eligible they come back undefined and the card renders no menu at all.
 */
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { deleteSelfAssigned } from '../services/workoutService';

export function canManageWorkout(workout) {
  return workout?.assignedByRole === 'member_self' && workout?.status === 'assigned';
}

export default function useWorkoutActions(navigation, reload) {
  const remove = useCallback((workout) => {
    Alert.alert(
      'Remove workout?',
      `${workout?.snapshot?.name || 'This workout'} will be taken off your schedule.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSelfAssigned(workout.id);
              await reload?.();
            } catch (e) {
              Alert.alert('Could not remove', e?.response?.data?.message || 'Please try again.');
            }
          },
        },
      ],
    );
  }, [reload]);

  /** → { onEdit, onRemove } for WorkoutDayCard, or {} when not eligible. */
  return useCallback((workout) => {
    if (!canManageWorkout(workout)) return {};
    return {
      onEdit: () => navigation.navigate('MdbEditWorkout', { workout }),
      onRemove: () => remove(workout),
    };
  }, [navigation, remove]);
}
