import { classLabel } from '@/lib/travel-copy';
import type { JourneyTrace } from '@/lib/journey-trace';

export function JourneySummary({
  trainNo,
  trainName,
  from,
  to,
  date,
  travelClass,
}: Pick<JourneyTrace, 'trainNo' | 'trainName' | 'from' | 'to' | 'date' | 'travelClass'>) {
  return (
    <aside className="rounded-2xl border border-border/80 bg-muted/30 p-6">
      <p className="text-xs tracking-wide text-muted-foreground">Journey</p>
      <p className="mt-3 text-lg font-medium tracking-tight">
        {trainNo ? `${trainNo} ` : ''}
        {trainName || 'Selected train'}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {[from, to].filter(Boolean).join(' → ') || 'Route'}
        {date ? ` · ${date}` : ''}
      </p>
      {travelClass ? (
        <p className="mt-4 text-sm">
          {classLabel(travelClass)}
          <span className="text-muted-foreground"> · Tatkal</span>
        </p>
      ) : null}
    </aside>
  );
}
