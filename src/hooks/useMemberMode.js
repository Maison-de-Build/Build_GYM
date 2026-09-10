/**
 * useMemberMode — resolves whether the signed-in member is 'pt'
 * (trainer-assigned) or 'freestyle' (no trainer).
 *
 * The pack branches a lot of surface area on this: calendar 01 vs 02, whether
 * the nutrition plan (07) and coach-sharing consent (18) exist at all, and
 * whether the template browser (10) is reachable — the backend already answers
 * 403 there for PT members, so this is a UI mirror of an enforced rule, never
 * the enforcement itself.
 *
 * The result is cached so paging between MDB screens does not re-hit
 * /customer/my-trainer on every mount. The cache is keyed by **user id**: an
 * earlier version cached a bare value, so once any PT member had signed in,
 * every later account on that install inherited mode 'pt' and a freestyle
 * member was shown screen 01. Keying by id makes a stale entry impossible to
 * mis-apply even if a sign-out path forgets to clear it.
 */
import { useEffect, useState } from 'react';
import { fetchMyTrainer } from '../services/trainerService';
import { useAuthStore } from '../store/authStore';

// userId → { mode, trainer }
let cache = new Map();

/** Called on logout, and safe to call on trainer reassignment. */
export function resetMemberMode(userId) {
  if (userId) cache.delete(userId);
  else cache.clear();
}

export default function useMemberMode() {
  const userId = useAuthStore((s) => s.user?.id) || null;

  const [state, setState] = useState(() => (userId ? cache.get(userId) : null) || null);
  const [loading, setLoading] = useState(() => !(userId && cache.has(userId)));

  useEffect(() => {
    if (!userId) { setLoading(false); return undefined; }

    const cached = cache.get(userId);
    if (cached) { setState(cached); setLoading(false); return undefined; }

    let alive = true;
    setLoading(true);
    (async () => {
      let next = { mode: 'freestyle', trainer: null };
      let cacheable = true;
      try {
        const trainer = await fetchMyTrainer(); // null when unassigned
        if (trainer) next = { mode: 'pt', trainer };
      } catch {
        // Network failure: fall back to freestyle so the screen still renders,
        // but do NOT cache a guess — otherwise one flaky request would pin a PT
        // member to the freestyle calendar for the rest of the session. The
        // template browser stays server-gated either way.
        cacheable = false;
      }
      if (cacheable) cache.set(userId, next);
      if (alive) { setState(next); setLoading(false); }
    })();

    return () => { alive = false; };
  }, [userId]);

  return {
    mode: state?.mode ?? 'freestyle',
    trainer: state?.trainer ?? null,
    isPt: state?.mode === 'pt',
    loading,
  };
}
