import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { BookingResult } from '@railflux/shared/api-types';
import { ApiError } from '@/api/client';
import { getBooking, isTerminalBookingStatus, pollBookingUntilTerminal } from '@/api/bookings';
import { ArchitectureReplay } from '@/components/architecture/ArchitectureReplay';
import { TrafficRush } from '@/components/architecture/TrafficRush';
import { CheckoutSteps } from '@/components/site/CheckoutSteps';
import { PageShell } from '@/components/app/PageShell';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { generateIdempotencyKey } from '@/lib/idempotency-key';
import { payHrefFromJourney, readJourneyTrace, type JourneyTrace } from '@/lib/journey-trace';

type LocationState = {
  result?: BookingResult;
  httpStatus?: number;
  idempotencyKey?: string;
  journey?: JourneyTrace;
};

function titleFor(result: BookingResult | null, loading: boolean): string {
  if (loading && !result) return 'Booking';
  if (result?.status === 'CONFIRMED') return 'Booking confirmed';
  if (result?.status === 'FAILED') return 'Payment declined';
  if (result?.status === 'SOLD_OUT') return 'Sold out';
  return 'Booking';
}

function leadFor(result: BookingResult | null): string {
  if (result?.status === 'CONFIRMED') return 'Your simulated ticket is ready.';
  if (result?.status === 'FAILED') {
    return 'Seats were released in the same RDS transaction. SQS was not used — retry starts a new booking.';
  }
  if (result?.status === 'SOLD_OUT') return 'No seats left on this inventory bucket.';
  return 'Waiting for a terminal status.';
}

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
  const failed = result?.status === 'FAILED';
  const soldOut = result?.status === 'SOLD_OUT';
  const canRetry = (failed || soldOut) && Boolean(journey?.inventoryId);
  const retryHref = useMemo(
    () => (canRetry ? payHrefFromJourney(journey, { idem: generateIdempotencyKey() }) : '/pay'),
    [canRetry, journey],
  );

  return (
    <PageShell wide title={titleFor(result, loading)} lead={leadFor(result)}>
      {confirmed ? <CheckoutSteps current={2} /> : null}
      {failed || soldOut ? <CheckoutSteps current={1} /> : null}
      {loading ? <p className="text-sm text-muted-foreground">Confirming…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
          <div>
            {result.simulatedPnr ? (
              <p className="font-mono text-3xl tracking-[0.18em]">{result.simulatedPnr}</p>
            ) : null}
            <p className="mt-3 text-sm text-muted-foreground">
              {result.status}
              {result.errorCode ? ` · ${result.errorCode}` : ''}
            </p>
            {failed ? (
              <p className="mt-4 max-w-md text-sm text-muted-foreground">
                Replaying the same Idempotency-Key returns this FAILED result. Retry mints a new
                key and claims seats again.
              </p>
            ) : null}
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
        {canRetry ? (
          <Link
            to={retryHref}
            className={cn(buttonVariants(), 'rounded-full px-4')}
          >
            Retry payment
          </Link>
        ) : null}
        <Link to="/search" className={cn(buttonVariants({ variant: 'ghost' }), 'rounded-full px-4')}>
          Book another
        </Link>
        <Link to="/architecture" className={cn(buttonVariants({ variant: 'ghost' }), 'rounded-full px-4')}>
          Architecture
        </Link>
      </div>

      {confirmed ? (
        <TrafficRush journey={journey} pnr={result?.simulatedPnr ?? null} bookingId={result?.bookingId} />
      ) : null}
      {confirmed ? <ArchitectureReplay journey={journey} pnr={result?.simulatedPnr ?? null} /> : null}
    </PageShell>
  );
}
