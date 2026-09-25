/**
 * demoBookingState.js — the practice booking, in memory only.
 *
 * Holds what the member picked so the success, bookings and transactions
 * screens can show it back to them. Never written to AsyncStorage, never sent
 * anywhere, and cleared when the guide ends — so closing the app mid-practice
 * loses it, which is the correct behaviour rather than a gap.
 *
 * It is a separate store from the app's real wallet deliberately. The real
 * balance lives in walletStore, which Home reads and a socket updates live;
 * borrowing it for a practice deduction would show the member a balance that
 * isn't theirs on a screen that isn't part of the guide.
 */
import { create } from 'zustand';

import { DEMO_BALANCE, DEMO_ACTIVITIES, demoDates, DEMO_SLOTS } from './demoData';

const initial = () => ({
  balance: DEMO_BALANCE,
  activity: null,
  dateIso: null,
  slotId: null,
  booked: false,
});

export const useDemoBooking = create((set, get) => ({
  ...initial(),

  pickActivity: (activity) => set({ activity }),
  pickDate: (dateIso) => set({ dateIso }),
  pickSlot: (slotId) => set({ slotId }),

  /** The practice "purchase": takes the price off the practice balance only. */
  confirm: () => {
    const { activity, booked } = get();
    if (!activity || booked) return;
    set({ booked: true, balance: get().balance - activity.coinPrice });
  },

  reset: () => set(initial()),
}));

/**
 * Everything the run needs, chosen up front.
 *
 * The member picks the activity, date and time themselves; seeding is the
 * backstop, so no screen ever opens with nothing on it. Every tap still
 * replaces the seeded choice.
 */
export function seedDemoBooking() {
  const dates = demoDates();
  useDemoBooking.setState({
    ...initial(),
    activity: DEMO_ACTIVITIES[0],
    dateIso: dates[0].iso,
    slotId: DEMO_SLOTS[0].id,
  });
}

export { DEMO_ACTIVITIES, DEMO_SLOTS, demoDates };
