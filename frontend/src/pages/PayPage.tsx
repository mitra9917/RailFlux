import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { createBooking, pollBookingUntilTerminal } from '@/api/bookings';
import { loadStoredToken } from '@/auth/synthetic-auth';
import { DEMO_PAYMENT_TOKEN } from '@/fixtures/tc001-demo';
import { generateIdempotencyKey } from '@/lib/idempotency-key';
import { patchJourneyTrace, readJourneyTrace } from '@/lib/journey-trace';
import { getSyntheticUserId } from '@/config/env';
import { CheckoutSteps } from '@/components/site/CheckoutSteps';
import { JourneySummary } from '@/components/site/JourneySummary';
import { PageShell } from '@/components/app/PageShell';
import { Button } from '@/components/ui/button';

function isTerminal(status: string): boolean {
  return status === 'CONFIRMED' || status === 'SOLD_OUT' || status === 'FAILED';
}

export function PayPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inventoryId = searchParams.get('inventoryId')?.trim() || readJourneyTrace()?.inventoryId || '';
  const trainRunId = searchParams.get('trainRunId')?.trim() || '';
  const travelClass = searchParams.get('class')?.trim() || '';
  const quota = searchParams.get('quota')?.trim() || '';
  const passengerName = searchParams.get('pax')?.trim() || readJourneyTrace()?.passengerName || '';
  const passengerAge = Number(searchParams.get('age') || readJourneyTrace()?.passengerAge || 30);
  const idempotencyKey = searchParams.get('idem')?.trim() || generateIdempotencyKey();
  const signedIn = useMemo(() => Boolean(loadStoredToken()), []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const journeyBits = {
    trainNo: searchParams.get('trainNo') || readJourneyTrace()?.trainNo,
    trainName: searchParams.get('name') || readJourneyTrace()?.trainName,
    from: searchParams.get('from') || readJourneyTrace()?.from,
    to: searchParams.get('to') || readJourneyTrace()?.to,
    date: searchParams.get('date') || readJourneyTrace()?.date,
    travelClass,
  };

  async function pay() {
    if (!inventoryId) {
      setError('Missing train. Start from Search.');
      return;
    }
    if (!signedIn) {
      setError('Sign in from the account menu first.');
      return;
    }
    setLoading(true);
    setError(null);
    setNote(null);
    const t0 = performance.now();
    try {
      const created = await createBooking(
        {
          userId: getSyntheticUserId(),
          inventoryId,
          passengers: [{ syntheticName: passengerName, age: passengerAge }],
          paymentToken: DEMO_PAYMENT_TOKEN,
        },
        idempotencyKey,
      );
      const journey = patchJourneyTrace({
        ...journeyBits,
        bookingMs: performance.now() - t0,
        inventoryId,
        trainRunId,
        travelClass,
        quota,
        passengerName,
        passengerAge,
      });

      if (created.kind === 'in_progress') {
        setNote('Confirming…');
        const terminal = await pollBookingUntilTerminal(created.body.bookingId);
        navigate(`/bookings/${terminal.bookingId}`, { state: { result: terminal, idempotencyKey, journey } });
        return;
      }
      if (!isTerminal(created.result.status)) {
        const terminal = await pollBookingUntilTerminal(created.result.bookingId);
        navigate(`/bookings/${terminal.bookingId}`, { state: { result: terminal, idempotencyKey, journey } });
        return;
      }
      navigate(`/bookings/${created.result.bookingId}`, {
        state: { result: created.result, httpStatus: created.httpStatus, idempotencyKey, journey },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errorCode ? `${err.errorCode}: ${err.message}` : err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Payment failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell title="Payment" lead="Simulated. No card is charged.">
      <CheckoutSteps current={1} />
      {!inventoryId ? (
        <p className="text-sm text-muted-foreground">
          Start from <Link to="/search">Search</Link>.
        </p>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[1fr_16rem]">
          <div className="max-w-md space-y-8">
            <div className="rounded-3xl border border-border/70 p-6">
              <p className="text-sm text-muted-foreground">Test card</p>
              <p className="mt-4 font-mono text-lg tracking-widest">4242 ····· ···· 4242</p>
              <p className="mt-6 text-sm text-muted-foreground">Success path · stub token</p>
            </div>
            <Button type="button" className="rounded-full px-6" disabled={loading || !signedIn} onClick={() => void pay()}>
              {loading ? 'Paying…' : note ?? 'Pay'}
            </Button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <JourneySummary {...journeyBits} />
        </div>
      )}
    </PageShell>
  );
}
