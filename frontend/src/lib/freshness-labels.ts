import type { CacheStatus, Freshness } from '@railflux/shared/api-types';

/**
 * Copy aligned with docs/design/api-spec.yaml (Freshness) and docs/design/cache-and-queue.md
 * (advisory reads only; UI must show freshness).
 */
export const ADVISORY_ALLOCATION_NOTE =
  'Displayed seats and train listings are not authoritative for allocation. Booking outcome is decided on the primary database path.';

export function cacheStatusLabel(status: CacheStatus): string {
  switch (status) {
    case 'BYPASS':
      return 'Cache bypassed (baseline / no Redis on this read)';
    case 'HIT':
      return 'Read cache hit (may be stale; short TTL on optimized profile)';
    case 'MISS':
      return 'Read cache miss (loaded from DB/replica for display)';
    default:
      return status;
  }
}

export function formatObservedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function formatFreshnessDetail(freshness: Freshness): string {
  return `${cacheStatusLabel(freshness.cacheStatus)} · observed ${formatObservedAt(freshness.observedAt)}`;
}
