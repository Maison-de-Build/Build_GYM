/**
 * press.js — the two kinds of button step.
 *
 * The rule: a step that highlights a button has no Next. The member presses the
 * button itself, the way they will for real. A step that highlights a card or a
 * block of read-only information keeps Next.
 *
 * The two kinds differ in what the press reaches:
 *
 *  - pressLive — a button on a practice screen. The press goes through to the
 *    control, which does its own work (picks the date, books, marks the set)
 *    and then calls advance() with its target id. Nothing sits over it.
 *
 *  - pressHome — a button on the real Home, where a guide starts. The press is
 *    caught by the overlay and moves the guide on, because letting it through
 *    would open the real screen instead of the practice one.
 */

export const pressLive = (hint) => ({
  mode: 'live',
  advanceOn: 'action',
  primaryLabel: null,
  hint,
});

export const pressHome = (hint) => ({
  mode: 'passive',
  advanceOn: 'tap',
  primaryLabel: null,
  hint,
});

/** True for either kind: the step moves on when its button is pressed. */
export const isPressStep = (step) => !step.primaryLabel && !!step.hint;
