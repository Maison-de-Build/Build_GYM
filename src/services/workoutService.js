import api from './apiService';

// ── Exercise Library ─────────────────────────────────────────────────────────

export const fetchExercises = async (muscleGroup) => {
  const params = muscleGroup ? { muscle_group: muscleGroup } : {};
  const { data } = await api.get('/exercises', { params });
  return data.data;
};

export const fetchExerciseById = async (id) => {
  const { data } = await api.get(`/exercises/${id}`);
  return data.data;
};

// ── Workout Plans (member endpoints) ─────────────────────────────────────────

export const fetchMyPlans = async () => {
  const { data } = await api.get('/member/plans');
  return data.data;
};

export const fetchTodaysPlan = async () => {
  const { data } = await api.get('/member/plans/today');
  return data.data;
};

// ── Workout Logs ─────────────────────────────────────────────────────────────

// Returns today's in_progress workout log (with preloaded sets), or null
export const fetchActiveWorkout = async (planId) => {
  const params = planId ? { planId } : {};
  const { data } = await api.get('/member/workouts/active', { params });
  return data.data; // null if no active session
};

export const startWorkout = async (body) => {
  // body: { planId } for Case A  OR  { muscleGroups: [...] } for Case B
  const { data } = await api.post('/member/workouts/start', body);
  return data.data;
};

export const logSet = async (workoutId, body) => {
  // body: { exerciseId, setNumber, setType, idempotencyKey, clientTs, remark, and
  //   the actuals for the exercise's measurement type — actualWeight/actualReps
  //   (weight_reps), actualReps (reps), actualTimeSeconds (time), actualDistance
  //   in meters (distance) }
  const { data } = await api.post(`/member/workouts/${workoutId}/sets`, body);
  return data;
};

export const getWorkoutSets = async (workoutId) => {
  const { data } = await api.get(`/member/workouts/${workoutId}/sets`);
  return data.data;
};

export const completeWorkout = async (workoutId) => {
  const { data } = await api.patch(`/member/workouts/${workoutId}/complete`);
  return data;
};

// ── Dated instances (Doc 4 §7) — trainer-assigned workouts by date ────────────
export const fetchInstances = async () => {
  const { data } = await api.get('/member/instances');
  return data.data; // { today, upcoming, history }
};

// Calendar month browser — instances for an explicit window. The unparameterised
// call above is anchored to "now" (today / next 7 / last 30), so it cannot answer
// for any other month.
export const fetchInstancesRange = async (from, to) => {
  const { data } = await api.get('/member/instances', { params: { from, to } });
  return data.data?.range || [];
};

export const startInstance = async (id) => {
  const { data } = await api.post(`/member/instances/${id}/start`);
  return data.data;
};

export const skipInstanceExercise = async (id, body) => {
  // body: { exerciseId, skipped, reason }
  const { data } = await api.post(`/member/instances/${id}/skip`, body);
  return data;
};

export const setInstanceRemark = async (id, remark) => {
  const { data } = await api.patch(`/member/instances/${id}/remark`, { remark });
  return data;
};

export const fetchMemberAssignmentBatch = async (instanceId) => {
  const { data } = await api.get(`/member/instances/${instanceId}/batch`);
  return data.data; // { batchId, templateName, instances: [{ id, workoutDate, status, isFuture }] }
};

export const fetchWorkoutHistory = async (params = {}) => {
  const { data } = await api.get('/member/workouts', { params });
  return data.data;
};

export const fetchWorkoutDetail = async (id) => {
  const { data } = await api.get(`/member/workouts/${id}`);
  return data.data;
};

export const fetchWeeklySummary = async () => {
  const { data } = await api.get('/member/workouts/summary/weekly');
  return data.data;
};

// ── Stats / KPIs ─────────────────────────────────────────────────────────────

export const fetchKPIs = async () => {
  const { data } = await api.get('/member/stats/kpis');
  return data.data;
};

export const fetchMuscleDistribution = async () => {
  const { data } = await api.get('/member/stats/muscle-distribution');
  return data.data;
};

// A.11 — lifetime reps/weight, volume trend, weekly totals, calorie summary
export const fetchExtendedStats = async () => {
  const { data } = await api.get('/member/stats/extended');
  return data.data;
};

export const fetchActivityRings = async () => {
  const { data } = await api.get('/member/stats/activity-rings');
  return data.data;
};

export const fetchPersonalRecords = async () => {
  const { data } = await api.get('/member/stats/prs');
  return data.data;
};

export const fetchExercisePRs = async (exerciseId) => {
  const { data } = await api.get(`/member/stats/prs/${exerciseId}`);
  return data.data;
};

export const fetchStreak = async () => {
  const { data } = await api.get('/member/streak');
  return data.data;
};

// ── Working Max (A.1) — read-only member view ────────────────────────────────
export const fetchWorkingMax = async (exerciseId) => {
  const params = exerciseId ? { exercise_id: exerciseId } : {};
  const { data } = await api.get('/member/working-max', { params });
  return data.data; // [{ exerciseId, exerciseName, estimated1rmKg, ... }]
};

// ── Plate settings (A.6) — member default bar weight ─────────────────────────
export const fetchPlateSettings = async () => {
  const { data } = await api.get('/member/plate-settings');
  return data.data; // { defaultBarWeightKg }
};

export const updatePlateSettings = async (defaultBarWeightKg) => {
  const { data } = await api.put('/member/plate-settings', { defaultBarWeightKg });
  return data.data;
};

// ── 1RM trend (A.11.2) ───────────────────────────────────────────────────────
export const fetch1rmTrend = async (exerciseId) => {
  const { data } = await api.get('/member/stats/1rm-trend', { params: { exercise_id: exerciseId } });
  return data.data; // [{ date, est1rm }]
};

// ── Freestyle template browser (A.4) — members with no trainer ───────────────
// Screen 09 — every Insights figure for one date range in a single call, so the
// Week | Month | All | Custom control is a single refetch.
export const fetchInsights = async (from, to) => {
  const { data } = await api.get('/member/stats/insights', { params: { from, to } });
  return data.data;
};

// Screen 16 — the member's last N logged sessions for one exercise, already
// collapsed server-side into set count / reps / per-set loads.
export const fetchExerciseSessions = async (exerciseId, limit = 5) => {
  const { data } = await api.get(`/member/stats/exercise/${exerciseId}/sessions`, { params: { limit } });
  return data.data;
};

export const fetchTemplateTagOptions = async () => {
  const { data } = await api.get('/template-tag-options', { params: { activeOnly: '1' } });
  return data.data; // { category:[], activity_target:[], frequency_fit:[] }
};

export const browseTemplates = async (filters = {}) => {
  const { data } = await api.get('/workout/templates/browse', { params: filters });
  return data.data; // enriched templates
};

// Screen 11 — per-member resolved prescription for one gym template. The
// backend runs the same buildSnapshot() the real assignment will, so "@ 62.5 kg
// (75% of your max)" here matches what lands on the calendar.
export const previewTemplate = async (templateId) => {
  const { data } = await api.get(`/workout/templates/${templateId}/preview`);
  return data.data;
};

export const selfAssignTemplate = async (templateId, date, replace = false) => {
  const { data } = await api.post(`/workout/templates/${templateId}/self-assign`, { date, replace });
  return data;
};

export const deleteSelfAssigned = async (workoutLogId) => {
  const { data } = await api.delete(`/workout/self-assigned/${workoutLogId}`);
  return data;
};

// ── Muscle recovery (A.7) + wellness survey (A.5) ────────────────────────────
export const fetchMuscleRecovery = async () => {
  const { data } = await api.get('/member/muscle-recovery');
  return data.data; // [{ muscleGroup, score, status }]
};

export const fetchWellnessToday = async (date) => {
  const { data } = await api.get('/member/wellness/today', { params: { date } });
  return data.data; // row or null
};

export const patchWellness = async ({ field, value, date, sessionId }) => {
  const { data } = await api.patch('/member/wellness/today', { field, value, date, sessionId });
  return data.data;
};

export const fetchWellnessTrend = async (from, to) => {
  const { data } = await api.get('/member/wellness/trend', { params: { from, to } });
  return data.data;
};

export const fetchRingGoals = async () => {
  const { data } = await api.get('/member/ring-goals');
  return data.data;
};

export const updateRingGoals = async (body) => {
  const { data } = await api.put('/member/ring-goals', body);
  return data.data;
};

// ── Nudges ───────────────────────────────────────────────────────────────────

export const fetchNudges = async (context) => {
  const { data } = await api.get('/member/nudges', { params: { context } });
  return data.data;
};

export const dismissNudge = async (type) => {
  await api.post(`/member/nudges/${type}/dismiss`);
};

export const convertNudge = async (type) => {
  await api.post(`/member/nudges/${type}/convert`);
};
