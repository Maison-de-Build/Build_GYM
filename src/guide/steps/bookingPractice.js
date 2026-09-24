/**
 * bookingPractice.js — Guide 3, the practice booking.
 *
 * A full dry run: open an activity, pick a day and a time, book it, then see it
 * land in My Bookings and come off the coin balance. Nothing leaves the phone —
 * the demo screens import no API client, so there is no booking to cancel and
 * no coins to refund afterwards.
 *
 * There is no category-filter step. The real Activities screen shows category
 * pills, but `activities` has no category column, so only "All" ever returns
 * anything; teaching the filter would teach a control that does nothing.
 *
 * My Bookings is reached the way the real app reaches it — from the success
 * screen — because it is not on Home.
 */
import { T } from '../targets';
import { ACTIONS } from '../copy';

const LIST = 'GuideDemoActivities';
const DETAIL = 'GuideDemoActivityDetail';
const SUCCESS = 'GuideDemoBookingSuccess';
const BOOKINGS = 'GuideDemoMyBookings';
const TXNS = 'GuideDemoTransactions';

const STEPS = [
  {
    id: 'K1', screen: LIST, target: T.DB_LIST,
    title: 'Activities',
    body: 'Everything you can book at the facility.',
  },
  {
    id: 'K2', screen: LIST, target: T.DB_CARD,
    title: 'Open an activity',
    body: 'Tap one to see the details.',
  },
  {
    id: 'K3', screen: DETAIL, target: T.DB_PRICE,
    title: 'Priced in Build Coins',
    body: 'What it costs, how long it runs and what’s included.',
  },
  {
    id: 'K4', screen: DETAIL, target: T.DB_DATE,
    title: 'Pick a date',
    body: 'Choose a day that works.',
  },
  {
    id: 'K5', screen: DETAIL, target: T.DB_SLOT,
    title: 'Pick a time',
    body: 'Choose a slot.',
  },
  {
    id: 'K6', screen: DETAIL, target: T.DB_BOOK,
    title: 'Book it',
    body: 'This is a practice run, so nothing’s charged.',
  },
  {
    id: 'K7', screen: SUCCESS, target: T.DB_VIEW_BOOKINGS,
    title: 'Booked',
    body: 'The coins came off your balance. Here’s where your booking lives.',
  },
  {
    id: 'K8', screen: BOOKINGS, target: T.DB_BOOKING_CARD,
    title: 'My bookings',
    body: 'Upcoming bookings sit here with the date, time and details.',
  },
  {
    id: 'K9', screen: TXNS, target: T.DB_TXN_ROW,
    title: 'Every coin, accounted for',
    body: 'Bookings and credits from the facility show up here.',
    primaryLabel: ACTIONS.done,
  },
];

export function bookingPracticeSteps() {
  return STEPS.map((step) => ({
    mode: 'passive',
    advanceOn: 'tap',
    primaryLabel: ACTIONS.next,
    exitLabel: ACTIONS.exitPractice,
    ...step,
  }));
}
