/**
 * wearableService.js — Part C device connections + synced health data.
 * Apple Health today; Whoop reuses the read endpoints later.
 */
import api from './apiService';

export const fetchWearableConnections = async () => {
  const { data } = await api.get('/wearables/connections');
  return data.data || [];
};

export const connectAppleHealth = async (scopes) => {
  const { data } = await api.post('/wearables/apple/connect', { scopes });
  return data.data;
};

export const disconnectAppleHealth = async () => {
  const { data } = await api.post('/wearables/apple/disconnect');
  return data.data;
};

// A first sync backfills 30 days, so allow more than the default 15s.
export const syncAppleHealth = async (payload) => {
  const { data } = await api.post('/wearables/apple/sync', payload, { timeout: 60000 });
  return data.data;
};

export const fetchWearableMetrics = async ({ from, to, provider = 'apple' } = {}) => {
  const { data } = await api.get('/wearables/metrics', { params: { from, to, provider } });
  return data.data;
};

export const fetchWearableWorkouts = async (params = {}) => {
  const { data } = await api.get('/wearables/workouts', { params });
  return data.data || [];
};
