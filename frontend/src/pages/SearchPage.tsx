import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { searchTrains } from '@/api/search';
import { loadStoredToken } from '@/auth/synthetic-auth';
import type { Freshness, TrainRun } from '@railflux/shared/api-types';
import { AdvisoryBanner } from '@/components/AdvisoryBanner';
import { FreshnessLabel } from '@/components/FreshnessLabel';
import { PageShell } from '@/components/app/PageShell';
import { SyntheticAuthPanel } from '@/components/SyntheticAuthPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { patchJourneyTrace } from '@/lib/journey-trace';

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [from, setFrom] = useState(searchParams.get('from')?.toUpperCase() || '');
  const [to, setTo] = useState(searchParams.get('to')?.toUpperCase() || '');
  const [date, setDate] = useState(searchParams.get('date') || '2026-04-01');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TrainRun[]>([]);
  const [freshness, setFreshness] = useState<Freshness | null>(null);

  const searchGen = useRef(0);

  const runSearch = useCallback(async (nextFrom: string, nextTo: string, nextDate: string) => {
    if (!loadStoredToken()) {
      setLoading(false);
      setItems([]);
      setError('Sign in on Home (Mint dev JWT) before search.');
      return;
    }
    const gen = ++searchGen.current;
    setLoading(true);
    setError(null);
    try {
      const t0 = performance.now();
      const data = await searchTrains({ from: nextFrom, to: nextTo, date: nextDate });
      if (searchGen.current !== gen) return;
      patchJourneyTrace({
        searchMs: performance.now() - t0,
        cacheStatus: data.freshness?.cacheStatus ?? null,
        from: nextFrom,
        to: nextTo,
        date: nextDate,
      });
      setItems(data.items ?? []);
      setFreshness(data.freshness ?? null);
    } catch (err) {
      if (searchGen.current !== gen) return;
      setItems([]);
      if (err instanceof ApiError) {
        setError(err.status === 401 ? 'Sign in on Home (Mint dev JWT) before search.' : err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Search failed');
      }
    } finally {
      if (searchGen.current === gen) setLoading(false);
    }
  }, []);

  const queryKey = searchParams.toString();

  useEffect(() => {
    const qFrom = (searchParams.get('from') || '').toUpperCase();
    const qTo = (searchParams.get('to') || '').toUpperCase();
    const qDate = searchParams.get('date') || '2026-04-01';
    setFrom(qFrom);
    setTo(qTo);
    setDate(qDate);
    void runSearch(qFrom, qTo, qDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, runSearch]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = { date };
    if (from) next.from = from;
    if (to) next.to = to;
    setSearchParams(next);
  }

  return (
    <PageShell
      title="Trains"
      lead={from || to ? `${from || 'any'} → ${to || 'any'} · ${date}` : `All trains · ${date}`}
    >
      <AdvisoryBanner />

      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <Input
          aria-label="From"
          value={from}
          onChange={(e) => setFrom(e.target.value.toUpperCase())}
          maxLength={3}
          placeholder="any"
          className="h-11 w-24"
        />
        <Input
          aria-label="To"
          value={to}
          onChange={(e) => setTo(e.target.value.toUpperCase())}
          maxLength={3}
          placeholder="any"
          className="h-11 w-24"
        />
        <Input
          aria-label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-11 w-44"
        />
        <Button type="submit" className="h-11 rounded-full px-5" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {error ? (
        <div className="max-w-md space-y-4">
          <p className="text-sm text-destructive">{error}</p>
          {error.includes('Sign in') ? (
            <SyntheticAuthPanel
              onSessionChange={(s) => {
                if (s) void runSearch(from, to, date);
              }}
            />
          ) : null}
        </div>
      ) : null}

      <div className="min-h-48">
        {loading ? <p className="py-10 text-sm text-muted-foreground">Loading trains…</p> : null}
        {!loading && items.length > 0 ? (
          <ul className="divide-y divide-border">
            {items.map((run) => (
              <li key={run.trainRunId}>
                <Link
                  to={`/availability?trainRunId=${encodeURIComponent(run.trainRunId)}&trainNo=${encodeURIComponent(run.trainNo)}&name=${encodeURIComponent(run.name)}&from=${encodeURIComponent(run.from)}&to=${encodeURIComponent(run.to)}&date=${encodeURIComponent(run.date)}`}
                  className="flex items-center justify-between gap-6 py-6 no-underline"
                >
                  <div>
                    <p className="text-lg font-medium tracking-tight">
                      {run.trainNo}
                      <span className="ml-3 font-normal text-muted-foreground">{run.name}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {run.from} → {run.to}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">Select</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <p className="py-10 text-sm text-muted-foreground">No trains for this route.</p>
        ) : null}
      </div>

      {freshness ? <FreshnessLabel freshness={freshness} context="Search results" /> : null}
    </PageShell>
  );
}
