import { ADVISORY_ALLOCATION_NOTE } from '@/lib/freshness-labels';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

/** Static advisory policy on read/book flows (M8 #74). */
export function AdvisoryBanner() {
  return (
    <Alert className="mb-4 border-amber-200/80 bg-amber-50/90 text-amber-950">
      <Info className="size-4 text-amber-700" />
      <AlertTitle>Advisory only</AlertTitle>
      <AlertDescription>{ADVISORY_ALLOCATION_NOTE}</AlertDescription>
    </Alert>
  );
}
