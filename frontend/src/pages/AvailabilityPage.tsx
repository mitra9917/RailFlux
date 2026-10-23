import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getAvailability } from '@/api/search';
import type { Availability, TravelClass } from '@railflux/shared/api-types';
import { AdvisoryBanner } from '@/components/AdvisoryBanner';
import { FreshnessLabel } from '@/components/FreshnessLabel';
import { PageShell } from '@/components/app/PageShell';
import { patchJourneyTrace } from '@/lib/journey-trace';
import { CLASS_LABEL } from '@/lib/travel-copy';
import { cn } from '@/lib/utils';

const CLASSES: TravelClass[] = ['SL', '3A', '2A'];

export function AvailabilityPage() {
  const [searchParams] = useSearchParams();
  const trainRunId = searchParams.get('trainRunId')?.trim() ?? '';
  const trainNo = searchParams.get('trainNo') ?? '';
  const trainName = searchParams.get('name') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const date = searchParams.get('date') ?? '';

  const [rows, setRows] = useState<Partial<Record<TravelClass, Availability | 'error'>>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!trainRunId) return;
    let cancelled = false;
    setLoading(true);
    const t0 = performance.now();
    void Promise.all(
      CLASSES.map(async (travelClass) => {
        try {
          const data = await getAvailability({ trainRunId, class: travelClass, quota: 'TATKAL' });
          return [travelClass, data] as const;
        } catch {
          return [travelClass, 'error'] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      const next: Partial<Record<TravelClass, Availability | 'error'>> = {};
      for (const [k, v] of entries) next[k] = v;
      setRows(next);
      const firstOk = entries.find(([, v]) => v !== 'error')?.[1];
      if (firstOk && firstOk !== 'error') {
        patchJourneyTrace({
          availabilityMs: performance.now() - t0,
          cacheStatus: firstOk.freshness?.cacheStatus ?? null,
          trainRunId,
          travelClass: firstOk.class,
          quota: firstOk.quota,
          trainNo,
          trainName,
          from,
          to,
          date,
        });
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [trainRunId, trainNo, trainName, from, to, date]);

  const freshnessRow = Object.values(rows).find(
    (row): row is Availability => Boolean(row) && row !== 'error',
  );

  const bookHref = (travelClass: TravelClass, inventoryId: string) => {
    const q = new URLSearchParams({
      inventoryId,
      trainRunId,
      class: travelClass,
      quota: 'TATKAL',
      trainNo,
      name: trainName,
      from,
      to,
      date,
    });
    return `/book?${q.toString()}`;
  };

  return (
    <PageShell
      title={trainName || 'Availability'}
      lead={[trainNo, from && to ? `${from} → ${to}` : '', date].filter(Boolean).join(' · ')}
    >
      <AdvisoryBanner />
      {!trainRunId ? (
        <p className="text-sm text-muted-foreground">
          Choose a train from <Link to="/search">Search</Link>.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {CLASSES.map((code) => {
            const row = rows[code];
            const ok = row && row !== 'error';
            const seats = ok ? row.displayedSeats : null;
            const bookable = ok && Boolean(row.inventoryId);
            return (
              <article key={code} className={cn('flex flex-col rounded-3xl border border-border/70 p-6')}>
                <p className="text-sm text-muted-foreground">{CLASS_LABEL[code]}</p>
                <p className="mt-8 text-3xl font-semibold tracking-tight">
                  {loading ? '—' : seats == null ? '—' : seats}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">seats shown (advisory)</p>
                {bookable ? (
                  <Link
                    to={bookHref(code, row.inventoryId)}
                    className="mt-10 text-sm font-medium text-foreground no-underline hover:opacity-70"
                  >
                    Select
                  </Link>
                ) : (
                  <p className="mt-10 text-sm text-muted-foreground">
                    {loading ? '' : row === 'error' ? 'Unavailable' : ''}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
      {freshnessRow ? (
        <FreshnessLabel freshness={freshnessRow.freshness} context="Displayed availability" />
      ) : null}
    </PageShell>
  );
}
