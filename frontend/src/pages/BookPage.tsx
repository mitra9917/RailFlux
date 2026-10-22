import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import {
  createBooking,
  pollBookingUntilTerminal,
} from '../api/bookings';
import { AdvisoryBanner } from '../components/AdvisoryBanner';
import { loadStoredToken } from '../auth/synthetic-auth';
import {
  DEMO_PAYMENT_TOKEN,
  TC001_INVENTORY_3A_ID,
  TC001_USER_ID,
} from '../fixtures/tc001-demo';
import { generateIdempotencyKey } from '../lib/idempotency-key';
import { getSyntheticUserId } from '../config/env';

export function BookPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultInventory = searchParams.get('inventoryId')?.trim() || TC001_INVENTORY_3A_ID;

  const [userId, setUserId] = useState(getSyntheticUserId());
  const [inventoryId, setInventoryId] = useState(defaultInventory);
  const [passengerName, setPassengerName] = useState('Synthetic Pax');
  const [passengerAge, setPassengerAge] = useState(30);
  const [paymentToken, setPaymentToken] = useState(DEMO_PAYMENT_TOKEN);
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateIdempotencyKey());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);

  const signedIn = useMemo(() => Boolean(loadStoredToken()), []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!signedIn) {
      setError('Sign in on Home before booking.');
      return;
    }

    setLoading(true);
    setError(null);
    setStatusLine(null);

    const body = {
      userId: userId.trim(),
      inventoryId: inventoryId.trim(),
      passengers: [{ syntheticName: passengerName.trim(), age: passengerAge }],
      paymentToken: paymentToken.trim(),
    };

    try {
      const created = await createBooking(body, idempotencyKey);
      if (created.kind === 'in_progress') {
        setStatusLine(`425 in progress — polling booking ${created.body.bookingId}…`);
        const terminal = await pollBookingUntilTerminal(created.body.bookingId, {
          onAttempt: (n) => setStatusLine(`Polling attempt ${n}…`),
        });
        navigate(`/bookings/${terminal.bookingId}`, { state: { result: terminal, idempotencyKey } });
        return;
      }

      if (!isTerminal(created.result.status)) {
        setStatusLine('Booking in progress — polling…');
        const terminal = await pollBookingUntilTerminal(created.result.bookingId, {
          onAttempt: (n) => setStatusLine(`Polling attempt ${n}…`),
        });
        navigate(`/bookings/${terminal.bookingId}`, { state: { result: terminal, idempotencyKey } });
        return;
      }

      navigate(`/bookings/${created.result.bookingId}`, {
        state: { result: created.result, httpStatus: created.httpStatus, idempotencyKey },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.errorCode ? `${err.errorCode}: ${err.message}` : `${err.message} (${err.status})`,
        );
      } else {
        setError(err instanceof Error ? err.message : 'Booking failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <h2>Book (Tatkal simulator)</h2>
      <AdvisoryBanner />
      {!signedIn ? (
        <p className="error">
          Sign in on <Link to="/">Home</Link> first.
        </p>
      ) : null}
      <p className="muted">
        Sends <code>Idempotency-Key</code> on POST /v1/bookings. Reuse the key to replay; rotate for a
        new attempt. Default inventory matches TC-001 3A (
        <code>{TC001_INVENTORY_3A_ID.slice(0, 8)}…</code>).
      </p>
      <form className="form-stack" onSubmit={(e) => void onSubmit(e)}>
        <label className="field">
          User ID (must match JWT sub)
          <input value={userId} onChange={(e) => setUserId(e.target.value)} spellCheck={false} />
        </label>
        <label className="field">
          Inventory ID
          <input value={inventoryId} onChange={(e) => setInventoryId(e.target.value)} spellCheck={false} />
        </label>
        <label className="field">
          Passenger name (synthetic)
          <input value={passengerName} onChange={(e) => setPassengerName(e.target.value)} maxLength={80} />
        </label>
        <label className="field">
          Passenger age
          <input
            type="number"
            min={1}
            max={120}
            value={passengerAge}
            onChange={(e) => setPassengerAge(Number(e.target.value))}
          />
        </label>
        <label className="field">
          Payment token (stub)
          <input value={paymentToken} onChange={(e) => setPaymentToken(e.target.value)} autoComplete="off" />
        </label>
        <label className="field">
          Idempotency-Key
          <input value={idempotencyKey} readOnly spellCheck={false} />
        </label>
        <div className="row">
          <button type="button" className="secondary" onClick={() => setIdempotencyKey(generateIdempotencyKey())}>
            New idempotency key
          </button>
          <button type="submit" disabled={loading || !signedIn}>
            {loading ? 'Booking…' : 'Create booking'}
          </button>
        </div>
      </form>
      {statusLine ? <p className="muted">{statusLine}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <p className="muted">
        JWT user should be <code>{TC001_USER_ID}</code> for fixture TC-001 inventory.
      </p>
    </section>
  );
}

function isTerminal(status: string): boolean {
  return status === 'CONFIRMED' || status === 'SOLD_OUT' || status === 'FAILED';
}
