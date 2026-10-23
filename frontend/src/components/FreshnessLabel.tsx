import type { Freshness } from '@railflux/shared/api-types';
import { ADVISORY_ALLOCATION_NOTE, formatFreshnessDetail } from '@/lib/freshness-labels';
import { cn } from '@/lib/utils';

type Props = {
  freshness: Freshness;
  context: string;
};

export function FreshnessLabel({ freshness, context }: Props) {
  if (freshness.authoritative !== false) {
    return null;
  }

  return (
    <div
      className={cn(
        'mt-3 space-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm',
      )}
      role="status"
    >
      <p className="font-medium">{context}</p>
      <p className="font-mono text-xs text-muted-foreground">{formatFreshnessDetail(freshness)}</p>
      <p className="text-xs text-muted-foreground">{ADVISORY_ALLOCATION_NOTE}</p>
    </div>
  );
}
