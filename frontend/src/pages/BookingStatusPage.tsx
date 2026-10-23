import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { BookingResult } from '@railflux/shared/api-types';
import { ApiError } from '@/api/client';
import { getBooking, isTerminalBookingStatus, pollBookingUntilTerminal } from '@/api/bookings';
import { ArchitectureReplay } from '@/components/architecture/ArchitectureReplay';
import { CheckoutSteps } from '@/components/site/CheckoutSteps';
import { PageShell } from '@/components/app/PageShell';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { readJourneyTrace, type JourneyTrace } from '@/lib/journey-trace';

type LocationState = {
  result?: BookingResult;
  httpStatus?: number;
  idempotencyKey?: string;
  journey?: JourneyTrace;
};

export function BookingStatusPage() {
  const { bookingId = '' } = useParams();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;

  const [result, setResult] = useState<BookingResult | null>(state.result ?? null);
  const [loading, setLoading] = useState(!state.result);
  const [error, setError] = useState<string | null>(null);
  const journey = state.journey ?? readJourneyTrace();

  useEffect(() => {
    if (!bookingId) return;
    if (state.result && isTerminalBookingStatus(state.result.status)) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const current = await getBooking(bookingId);
        if (cancelled) return;
        if (!isTerminalBookingStatus(current.status)) {
          const terminal = await pollBookingUntilTerminal(bookingId);
          if (!cancelled) setResult(terminal);
        } else {
          setResult(current);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Could not load booking');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [bookingId, state.result]);

  const confirmed = result?.status === 'CONFIRMED';

  return (
    <PageShell
      wide
      title={confirmed ? 'Booking confirmed' : 'Booking'}
      lead={confirmed ? 'Your simulated ticket is ready.' : 'Waiting for a terminal status.'}
    >
      {confirmed ? <CheckoutSteps current={2} /> : null}
      {loading ? <p className="text-sm text-muted-foreground">Confirming…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
          <div>
            {result.simulatedPnr ? (
              <p className="font-mono text-3xl tracking-[0.18em]">{result.simulatedPnr}</p>
            ) : null}
            <p className="mt-3 text-sm text-muted-foreground">{result.status}</p>
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="text-foreground">
              {journey?.trainNo} {journey?.trainName}
            </p>
            <p className="mt-1">
              {journey?.from} → {journey?.to}
              {journey?.date ? ` · ${journey.date}` : ''}
            </p>
            {journey?.passengerName ? <p className="mt-4">{journey.passengerName}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link to="/search" className={cn(buttonVariants({ variant: 'ghost' }), 'rounded-full px-4')}>
          Book another
        </Link>
        <Link to="/architecture" className={cn(buttonVariants({ variant: 'ghost' }), 'rounded-full px-4')}>
          Architecture
        </Link>
      </div>

      {confirmed ? <ArchitectureReplay journey={journey} pnr={result?.simulatedPnr ?? null} /> : null}
    </PageShell>
  );
}
