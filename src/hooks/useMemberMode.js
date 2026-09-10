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
 * Result is cached module-wide for the session so a member paging between MDB
 * screens does not re-hit /customer/my-trainer on every mount.
 */
import { useEffect, useState } from 'react';
import { fetchMyTrainer } from '../services/trainerService';

let cache; // { mode, trainer } — cleared by resetMemberMode() on logout/reassign.

export function resetMemberMode() {
  cache = undefined;
}

export default function useMemberMode() {
  const [state, setState] = useState(() => cache || null);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    (async () => {
      let next = { mode: 'freestyle', trainer: null };
      try {
        const trainer = await fetchMyTrainer();
        if (trainer) next = { mode: 'pt', trainer };
      } catch {
        // Network failure: fall back to freestyle so the screen still renders.
        // The template browser stays server-gated, so a wrong guess is safe.
      }
      cache = next;
      if (alive) { setState(next); setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  return {
    mode: state?.mode ?? 'freestyle',
    trainer: state?.trainer ?? null,
    isPt: state?.mode === 'pt',
    loading,
  };
}
