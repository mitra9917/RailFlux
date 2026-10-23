import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { createBooking, pollBookingUntilTerminal } from '@/api/bookings';
import { loadStoredToken } from '@/auth/synthetic-auth';
import { DEMO_PAYMENT_FAIL_TOKEN, DEMO_PAYMENT_SUCCESS_TOKEN } from '@/fixtures/tc001-demo';
import { generateIdempotencyKey } from '@/lib/idempotency-key';
import { patchJourneyTrace, readJourneyTrace } from '@/lib/journey-trace';
import { getSyntheticUserId } from '@/config/env';
import { CheckoutSteps } from '@/components/site/CheckoutSteps';
import { JourneySummary } from '@/components/site/JourneySummary';
import { PageShell } from '@/components/app/PageShell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function isTerminal(status: string): boolean {
  return status === 'CONFIRMED' || status === 'SOLD_OUT' || status === 'FAILED';
}

type StubPath = 'approve' | 'decline';

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

  const [path, setPath] = useState<StubPath>('approve');
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
          paymentToken: path === 'decline' ? DEMO_PAYMENT_FAIL_TOKEN : DEMO_PAYMENT_SUCCESS_TOKEN,
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
    <PageShell title="Payment" lead="Simulated stub. No card is charged.">
      <CheckoutSteps current={1} />
      {!inventoryId ? (
        <p className="text-sm text-muted-foreground">
          Start from <Link to="/search">Search</Link>.
        </p>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[1fr_16rem]">
          <div className="max-w-lg space-y-8">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPath('approve')}
                className={cn(
                  'rounded-3xl border p-6 text-left transition-colors',
                  path === 'approve' ? 'border-foreground' : 'border-border/70',
                )}
              >
                <p className="text-sm text-muted-foreground">Approve</p>
                <p className="mt-4 font-mono text-lg tracking-widest">4242 ···· 4242</p>
                <p className="mt-6 text-sm text-muted-foreground">
                  Confirm booking, then SQS notify
                </p>
              </button>
              <button
                type="button"
                onClick={() => setPath('decline')}
                className={cn(
                  'rounded-3xl border p-6 text-left transition-colors',
                  path === 'decline' ? 'border-foreground' : 'border-border/70',
                )}
              >
                <p className="text-sm text-muted-foreground">Decline</p>
                <p className="mt-4 font-mono text-lg tracking-widest">4000 ···· 0002</p>
                <p className="mt-6 text-sm text-muted-foreground">
                  Release seats in the same transaction
                </p>
              </button>
            </div>
            <Button
              type="button"
              className="rounded-full px-6"
              disabled={loading || !signedIn}
              onClick={() => void pay()}
            >
              {loading ? 'Paying…' : note ?? (path === 'decline' ? 'Decline payment' : 'Pay')}
            </Button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Payment is in-process on the booking request — SQS does not retry a declined card.
              Fail uses a new Idempotency-Key. Success on the optimized stack publishes notify to
              SQS; the worker retries and DLQs poison messages.
            </p>
          </div>
          <JourneySummary {...journeyBits} />
        </div>
      )}
    </PageShell>
  );
}
