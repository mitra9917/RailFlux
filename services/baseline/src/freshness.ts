import type { Freshness } from '@railflux/shared';

/** Baseline read path: always advisory, no Redis cache. */
export function baselineReadFreshness(): Freshness {
  return {
    observedAt: new Date().toISOString(),
    authoritative: false,
    cacheStatus: 'BYPASS',
  };
}
