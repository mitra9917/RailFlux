import { ADVISORY_ALLOCATION_NOTE } from '../lib/freshness-labels';

/** Static advisory policy on read/book flows (M8 #74). */
export function AdvisoryBanner() {
  return (
    <p className="advisory-banner" role="note">
      <strong>Advisory only.</strong> {ADVISORY_ALLOCATION_NOTE}
    </p>
  );
}
