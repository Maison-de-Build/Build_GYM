import { describe, it, expect } from 'vitest';
import {
  buildReturnRoutes, pruneDemoRoutes, snapshotNames, isDemoRoute,
} from '../guideNav.js';

const r = (name, key = `${name}-k`) => ({ name, key });

describe('buildReturnRoutes', () => {
  // The original bug: ending a replay reset to [Profile] alone, so nothing sat
  // underneath it and back went nowhere.
  it('rebuilds the whole replay stack, not a lone Profile screen', () => {
    const now = [r('MainTabs'), r('GuideDemoActivities'), r('GuideDemoActivityDetail')];
    const out = buildReturnRoutes(now, ['MainTabs', 'Profile', 'GuideReplay']);
    expect(out.map((x) => x.name)).toEqual(['MainTabs', 'Profile', 'GuideReplay']);
  });

  it('keeps the existing Home route, key and all, so Home does not remount', () => {
    const home = r('MainTabs', 'home-123');
    const out = buildReturnRoutes([home, r('GuideDemoPlayer')], ['MainTabs']);
    expect(out).toEqual([home]);
    expect(out[0].key).toBe('home-123');
  });

  it('drops every demo screen a guide pushed on top', () => {
    const now = [r('MainTabs'), r('GuideDemoWorkoutChoice'), r('GuideDemoPlayer'), r('GuideDemoSummary')];
    expect(buildReturnRoutes(now, ['MainTabs']).map((x) => x.name)).toEqual(['MainTabs']);
  });

  it('stops reusing keys at the first disagreement', () => {
    const now = [r('MainTabs', 'h'), r('Activities', 'a')];
    const out = buildReturnRoutes(now, ['MainTabs', 'Profile']);
    expect(out[0].key).toBe('h');
    expect(out[1]).toEqual({ name: 'Profile' });
  });

  it('never returns an empty stack', () => {
    expect(buildReturnRoutes([], [])).toEqual([{ name: 'MainTabs' }]);
    expect(buildReturnRoutes([r('MainTabs')], ['GuideDemoPlayer'])).toEqual([{ name: 'MainTabs' }]);
  });
});

describe('pruneDemoRoutes', () => {
  // A notification opening a real screen mid-guide must not leave practice
  // screens underneath it for back to land on.
  it('keeps real screens and drops practice ones', () => {
    const now = [r('MainTabs'), r('GuideDemoActivities'), r('GuideDemoActivityDetail'), r('ChatThread')];
    expect(pruneDemoRoutes(now).map((x) => x.name)).toEqual(['MainTabs', 'ChatThread']);
  });

  it('falls back to Home if nothing real is left', () => {
    expect(pruneDemoRoutes([r('GuideDemoChat')])).toEqual([{ name: 'MainTabs' }]);
  });
});

describe('snapshotNames', () => {
  it('records the stack a guide was launched from, minus demo screens', () => {
    expect(snapshotNames([r('MainTabs'), r('GuideDemoChat')])).toEqual(['MainTabs']);
    expect(snapshotNames([r('MainTabs'), r('Profile')])).toEqual(['MainTabs', 'Profile']);
  });

  it('defaults to Home', () => {
    expect(snapshotNames([])).toEqual(['MainTabs']);
  });
});

describe('isDemoRoute', () => {
  it('recognises practice screens by their prefix only', () => {
    expect(isDemoRoute('GuideDemoPlayer')).toBe(true);
    expect(isDemoRoute('GuideReplay')).toBe(false);
    expect(isDemoRoute('MainTabs')).toBe(false);
    expect(isDemoRoute(undefined)).toBe(false);
  });
});
