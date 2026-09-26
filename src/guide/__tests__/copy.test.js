import { describe, it, expect } from 'vitest';
import { TOUR, CARD, REPLAY, ACTIONS, DEMO_BANNER } from '../copy.js';

/**
 * Guide copy is frozen by the spec, so these are less about logic than about a
 * typo or a bad escape reaching a member. Every string here is rendered.
 */
describe('guide copy', () => {
  const allStrings = (node, out = []) => {
    if (typeof node === 'string') out.push(node);
    else if (node && typeof node === 'object') Object.values(node).forEach((v) => allStrings(v, out));
    return out;
  };

  const strings = allStrings([TOUR, CARD, REPLAY, ACTIONS, DEMO_BANNER]);

  it('has no unresolved escape sequences left in any line', () => {
    for (const str of strings) {
      expect(str, str).not.toMatch(/\\u[0-9a-fA-F]{4}/);
      expect(str, str).not.toMatch(/\\n|\\t/);
    }
  });

  it('renders curly apostrophes as real characters', () => {
    expect(CARD.allDone).toBe('You’re set.');
    expect(DEMO_BANNER.booking).toBe('Practice run. Nothing’s booked, no coins used.');
  });

  it('has no empty or whitespace-only lines', () => {
    for (const str of strings) expect(str.trim().length, str).toBeGreaterThan(0);
  });

  // The card counts rows; the sub-line is what a member reads to decide whether
  // to tap. A missing one would render a blank second line.
  it('gives every card row a title and a sub-line', () => {
    for (const [key, row] of Object.entries(CARD.rows)) {
      expect(row.title?.length, key).toBeGreaterThan(0);
      expect(row.sub?.length, key).toBeGreaterThan(0);
    }
  });

  it('gives every replay row a title and a sub-line', () => {
    for (const [key, row] of Object.entries(REPLAY.rows)) {
      expect(row.title?.length, key).toBeGreaterThan(0);
      expect(row.sub?.length, key).toBeGreaterThan(0);
    }
  });

  // The whole point of the demo approach is that nothing is written. A replay
  // sub-line promising saved data would be the one false claim in the feature.
  it('never tells the member a practice run saves anything', () => {
    expect(REPLAY.rows.first_workout.sub).not.toMatch(/saved|is saved|real workout/i);
    expect(REPLAY.rows.booking_practice.sub).toMatch(/nothing/i);
    expect(REPLAY.rows.first_workout.sub).toMatch(/nothing/i);
  });

  it('formats the card progress counter both ways round', () => {
    expect(CARD.progress(0, 2)).toBe('0 of 2 done');
    expect(CARD.progress(3, 3)).toBe('3 of 3 done');
  });

  // A coached member never plans, so their variants must not mention planning.
  it('keeps planning out of the coached variants', () => {
    expect(CARD.rows.first_workout.subCoached).not.toMatch(/plan/i);
    expect(TOUR.todayWorkoutCoached.body).not.toMatch(/pick a template|build your own/i);
  });
});
