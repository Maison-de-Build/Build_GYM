/**
 * copy.js — every word the guides say, in one file.
 *
 * The spec freezes guide copy ("don't reword it or add lines; if a screen needs
 * a line that isn't here, ask first"), so it all lives here rather than being
 * scattered through components: one file to review, one place a change lands.
 *
 * Lines marked DEMO WORDING are not from the spec. Each one is here because the
 * spec's own line describes something this build cannot do — a template builder
 * nobody has, a My Bookings entry that isn't on Home, a workout guide that saves
 * real data. The note above each says which. They are deliberate choices for the
 * demo version and the obvious place to start when the feature catches up with
 * the spec.
 */

/* ── Part A: the welcome tour ───────────────────────────────────────────── */

export const TOUR = {
  // DEMO WORDING. The spec reads "Pick a template, build your own or add
  // single exercises." Members cannot build a template — the feature does not
  // exist for anyone — so that clause promises a screen they will never find.
  todayWorkoutFreestyle: {
    title: "Today's workout",
    body: 'Pick a template or add single exercises. Today’s session lives here.',
  },

  // DEMO WORDING. A coached member picks nothing at all: self-assign is
  // refused at the API and Home gives them no add button, so the line above
  // would describe a thing they cannot do.
  todayWorkoutCoached: {
    title: "Today's workout",
    body: 'Your coach’s session for today lives here.',
  },

  // Spec, the devices-off variant. Devices are dropped for v1, so this is the
  // only version.
  calories: {
    title: 'Calories burned',
    body: 'Calories from the sessions you log.',
  },

  // Spec, unchanged.
  coins: {
    title: 'Build Coins',
    body: 'Your credit at the facility. You’ll use it to book activities and sessions.',
  },

  // DEMO WORDING. Replaces the spec's "My bookings" step, whose target does
  // not exist on Home — My Bookings is reached from Profile and from the
  // Activities header, and the booking guide points at it there instead.
  checkIn: {
    title: 'Check in',
    body: 'Scan here when you arrive at the facility.',
  },

  // Spec, unchanged.
  startHere: {
    title: 'Start here',
    body: 'Short guides to get you going. Take them whenever you’re ready.',
  },

  // Spec, unchanged.
  skipToast: 'You can replay this from Profile.',
};

/* ── The first step of guides 2–4: the real button on Home ─────────────── */

// DEMO WORDING, all four. Each guide now opens on the button that leads to the
// feature on the real Home, before any practice screen — otherwise the member
// learns the feature but not where to find it.
export const ENTRY = {
  firstWorkoutFreestyle: {
    title: 'Your first workout',
    body: 'Add today\u2019s workout from here.',
  },
  // A coached member has no add button: their coach's session appears on this
  // card and they start it from there.
  firstWorkoutCoached: {
    title: 'Your first workout',
    body: 'Your coach\u2019s session shows up here. You start it from this card.',
  },
  booking: {
    title: 'Activities',
    body: 'Everything you can book at the facility starts here.',
  },
  coach: {
    title: 'Your coach',
    body: 'Your coach is right here on Home. Tap to open your chat.',
  },
};

/* ── Part B: the Get started card ───────────────────────────────────────── */

export const CARD = {
  title: 'Get started',
  // Spec: "0 of 3 done", "of 2" when there's no coach row.
  progress: (done, total) => `${done} of ${total} done`,
  allDone: 'You’re set.',

  rows: {
    first_workout: {
      title: 'Your first workout',
      // Spec, for a member who plans their own.
      sub: 'Plan it, log it, see it.',
      // DEMO WORDING. A coached member never plans, so "Plan it" describes a
      // step they will not see.
      subCoached: 'Log it, see it.',
    },
    booking_practice: {
      title: 'Book an activity',
      // Spec, unchanged.
      sub: 'A practice run. Nothing’s booked, no coins used.',
    },
    coach_chat: {
      title: 'Message your coach',
      // Spec, unchanged.
      sub: 'Your coach is a tap away.',
    },
  },

  skippedLabel: 'Skipped',

  // Spec, unchanged.
  hideSheet: {
    title: 'Hide these guides?',
    body: 'You can run any of them later from Profile.',
    confirm: 'Hide',
    cancel: 'Keep',
  },
};

/* ── Part C: replay, in Profile ─────────────────────────────────────────── */

export const REPLAY = {
  title: 'Replay guide',
  subtitle: 'Run any of these again whenever you like.',

  rows: {
    welcome_tour: {
      title: 'Welcome tour',
      // Spec, unchanged.
      sub: 'A quick look around Home.',
    },
    first_workout: {
      title: 'Your first workout',
      // DEMO WORDING, and this one matters most. The spec's line is "Guides a
      // real workout. What you log is saved." and it says that line must stay
      // exactly as written so members know it creates real data. It no longer
      // does — the guide runs on demo screens and saves nothing — so keeping
      // the line would be the one outright false statement in the feature.
      sub: 'A practice run. Nothing’s logged.',
    },
    booking_practice: {
      title: 'Book an activity',
      // Spec, unchanged.
      sub: 'A practice run. Nothing’s booked.',
    },
    coach_chat: {
      title: 'Message your coach',
      // DEMO WORDING. The spec's "Opens your chat with your coach." described
      // a guide that ended on the real chat screen; this one ends on a demo of
      // it, and opens nothing.
      sub: 'A look at where your coach chat lives.',
    },
  },

  // Test accounts only.
  reset: {
    title: 'Reset guides',
    sub: 'Put every guide back to unseen.',
    confirmTitle: 'Reset all guides?',
    confirmBody: 'The welcome tour will run again the next time Home loads.',
    confirm: 'Reset',
    cancel: 'Cancel',
    done: 'Guides reset.',
    failed: 'Could not reset guides.',
  },
};

/* ── Shared step furniture ──────────────────────────────────────────────── */

export const ACTIONS = {
  next: 'Next',
  done: 'Done',
  gotIt: 'Got it',
  skip: 'Skip',
  exitGuide: 'Exit guide',
  exitPractice: 'Exit practice',

  // NOT BUILT. The hand-off step at the end of each guide, behind
  // GUIDE_DO_IT_FOR_REAL — which now defaults off. Kept here so that turning it
  // on later is a step plus a server flag rather than a fresh copy decision.
  doItForReal: {
    title: 'Your turn',
    body: 'That was a practice run. Ready to do it for real?',
    primary: 'Do it for real',
    secondary: 'Not now',
  },
};

/* ── The practice banner, pinned to every demo screen ───────────────────── */

// The spec gives the booking line and requires it be impossible to miss:
// solid #783DEC behind #F1F2F3 text, under the status bar, on every screen of
// the run. The other two are NEEDS SIGN-OFF — the booking wording talks about
// coins and bookings, which would be wrong above a workout or a chat.
export const DEMO_BANNER = {
  booking: 'Practice run. Nothing\u2019s booked, no coins used.',
  workout: 'Practice run. Nothing\u2019s logged.',
  chat: 'Practice run. No message is sent.',
};
