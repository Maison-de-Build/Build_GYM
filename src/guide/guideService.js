/**
 * guideService.js — the onboarding guide's only network calls.
 *
 * Four endpoints, all scoped to the member in the JWT. Nothing else the guide
 * does touches the network: the guides themselves run on demo screens fed by
 * bundled mock data, so there is no booking, coin, workout or chat call to make
 * and nothing to guard against.
 */
import api from './../services/apiService';

/** Which guides are switched on for this member, and who they are. */
export const fetchGuideConfig = async () => {
  const { data } = await api.get('/member/guide-config');
  return data.data; // { welcome, firstWorkout, bookingPractice, coachChat, doItForReal, hasCoach, isTestAccount }
};

/** How far this member has got. */
export const fetchGuideState = async () => {
  const { data } = await api.get('/member/guide-state');
  return data.data;
};

/** Partial merge. The server stamps updated_at; we never send it. */
export const patchGuideState = async (partial) => {
  const { data } = await api.patch('/member/guide-state', partial);
  return data.data;
};

/** Test accounts only — the server refuses anyone else with a 403. */
export const resetGuideState = async () => {
  const { data } = await api.post('/member/guide-state/reset');
  return data.data;
};
