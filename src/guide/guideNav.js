/**
 * guideNav.js — how a guide leaves the navigation stack when it ends.
 *
 * Pure functions over react-navigation route arrays, kept apart from the
 * provider so they can be unit tested without a navigator.
 *
 * The first version reset the stack to a single screen when a guide ended. That
 * wiped everything beneath it: a replay launched from Profile ended on a lone
 * Profile screen with nothing under it, so neither its back arrow nor the phone's
 * back button had anywhere to go. These helpers rebuild the stack the member is
 * meant to return to instead.
 */

/** Demo screens are registered under this prefix; nothing real uses it. */
export const DEMO_PREFIX = 'GuideDemo';

export const isDemoRoute = (name) => typeof name === 'string' && name.startsWith(DEMO_PREFIX);

/**
 * The routes to reset to when a guide ends.
 *
 * `names` is the stack to land on, bottom first. Routes already in the stack are
 * reused for as long as the two agree from the bottom up — reusing a route keeps
 * its key, so the screen stays mounted rather than remounting. Home in
 * particular would otherwise refetch everything the moment a guide finished.
 * Past the first disagreement everything is fresh, since a route's key only
 * makes sense in its original position.
 */
export function buildReturnRoutes(existing = [], names = []) {
  const wanted = names.filter((n) => typeof n === 'string' && n && !isDemoRoute(n));
  if (wanted.length === 0) return [{ name: 'MainTabs' }];

  const out = [];
  let reusing = true;
  wanted.forEach((name, i) => {
    const r = existing[i];
    if (reusing && r && r.name === name) out.push(r);
    else { reusing = false; out.push({ name }); }
  });
  return out;
}

/**
 * The stack with every demo screen removed.
 *
 * Used when a guide is abandoned rather than finished — the member followed a
 * notification, or something else took them off the guide's screen. They stay
 * wherever they went, but the practice screens underneath are dropped, or backing
 * out would land them on a demo booking with no guide running.
 */
export function pruneDemoRoutes(existing = []) {
  const kept = existing.filter((r) => !isDemoRoute(r?.name));
  return kept.length ? kept : [{ name: 'MainTabs' }];
}

/** The route names of a stack, bottom first, without any demo screens. */
export function snapshotNames(existing = []) {
  const names = existing.map((r) => r?.name).filter((n) => n && !isDemoRoute(n));
  return names.length ? names : ['MainTabs'];
}
