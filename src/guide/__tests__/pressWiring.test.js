import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { firstWorkoutSteps } from '../steps/firstWorkout.js';
import { bookingPracticeSteps } from '../steps/bookingPractice.js';
import { coachChatSteps } from '../steps/coachChat.js';
import { T } from '../targets.js';

/**
 * A live step has no Next button: the only way on is the control it points at
 * calling advance() with that step's target. A live step whose control never
 * makes that call leaves the member with a highlighted button that does nothing
 * and no Next to fall back on — stuck until they find Exit. This checks every
 * live step's target is reported by some practice screen.
 */
const DEMO_DIR = join(process.cwd(), 'src/guide/demo');
const source = readdirSync(DEMO_DIR)
  .filter((f) => f.endsWith('.js'))
  .map((f) => readFileSync(join(DEMO_DIR, f), 'utf8'))
  .join('\n');

const keyOf = (value) => Object.keys(T).find((k) => T[k] === value);

const liveSteps = [
  ...firstWorkoutSteps({ hasCoach: false }),
  ...bookingPracticeSteps(),
  ...coachChatSteps(),
].filter((s) => s.mode === 'live');

describe('live steps', () => {
  it('exist', () => {
    expect(liveSteps.length).toBeGreaterThan(0);
  });

  it.each(liveSteps.map((s) => [s.id, s.target]))(
    '%s — its control calls advance() with its target',
    (_id, target) => {
      const key = keyOf(target);
      expect(key).toBeTruthy();
      expect(source).toContain(`advance(T.${key})`);
    },
  );
});
