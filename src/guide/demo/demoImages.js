/**
 * demoImages.js — cover photos for the practice activities, bundled.
 *
 * The same photos the live activity rows point at, copied into the app so the
 * practice list looks exactly like the real one without fetching anything. Kept
 * out of demoData.js because require() of an image doesn't load in the plain
 * node test run, and the dataset itself is tested.
 *
 * If real photos are uploaded for these activities later, replace these files
 * to match.
 */
export const DEMO_COVERS = {
  Yoga: require('../../../assets/guide/activity-yoga.jpg'),
  HIIT: require('../../../assets/guide/activity-hiit.jpg'),
  Cycling: require('../../../assets/guide/activity-cycling.jpg'),
  Pickleball: require('../../../assets/guide/activity-pickleball.jpg'),
  'Sauna & Steam': require('../../../assets/guide/activity-sauna.jpg'),
};
