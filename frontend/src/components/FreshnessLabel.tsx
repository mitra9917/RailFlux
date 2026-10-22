import type { Freshness } from '@railflux/shared/api-types';
import { ADVISORY_ALLOCATION_NOTE, formatFreshnessDetail } from '../lib/freshness-labels';

type Props = {
  freshness: Freshness;
  /** e.g. "Search results" or "Displayed availability" */
  context: string;
};

/** Per-response freshness metadata (M8 #74). */
export function FreshnessLabel({ freshness, context }: Props) {
  if (freshness.authoritative !== false) {
    return null;
  }

  return (
    <p className="freshness-label" role="status">
      <span className="freshness-label-context">{context}</span>
      <span className="freshness-label-detail">{formatFreshnessDetail(freshness)}</span>
      <span className="freshness-label-note">{ADVISORY_ALLOCATION_NOTE}</span>
    </p>
  );
}
