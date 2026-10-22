import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { BookingResult } from '@railflux/shared/api-types';
import { ApiError } from '../api/client';
import { getBooking, isTerminalBookingStatus, pollBookingUntilTerminal } from '../api/bookings';

type LocationState = {
  result?: BookingResult;
  httpStatus?: number;
  idempotencyKey?: string;
};

export function BookingStatusPage() {
  const { bookingId = '' } = useParams();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;

  const [result, setResult] = useState<BookingResult | null>(state.result ?? null);
  const [httpStatus] = useState<number | null>(state.httpStatus ?? null);
  const [idempotencyKey] = useState(state.idempotencyKey ?? null);
  const [loading, setLoading] = useState(!state.result);
  const [error, setError] = useState<string | null>(null);
  const [pollNote, setPollNote] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    if (state.result && isTerminalBookingStatus(state.result.status)) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const current = await getBooking(bookingId);
        if (cancelled) return;
        if (!isTerminalBookingStatus(current.status)) {
          setPollNote('Still in progress — polling GET /v1/bookings…');
          const terminal = await pollBookingUntilTerminal(bookingId, {
            onAttempt: (n) => setPollNote(`Polling attempt ${n}…`),
          });
          if (!cancelled) {
            setResult(terminal);
            setPollNote(null);
          }
        } else {
          setResult(current);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : 'Status check failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [bookingId, state.result]);

  return (
    <section className="panel">
      <h2>Booking status</h2>
      {!bookingId ? (
        <p className="error">Missing booking ID.</p>
      ) : (
        <>
          <p className="muted">
            GET <code>/v1/bookings/{bookingId}</code>
          </p>
          {idempotencyKey ? (
            <p className="muted">
              Idempotency-Key used: <code>{idempotencyKey.slice(0, 24)}…</code>
            </p>
          ) : null}
          {loading ? <p className="muted">{pollNote ?? 'Loading…'}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          {result ? (
            <dl className="status-dl">
              {httpStatus != null ? (
                <>
                  <dt>HTTP (create)</dt>
                  <dd>{httpStatus}</dd>
                </>
              ) : null}
              <dt>Booking ID</dt>
              <dd>
                <code>{result.bookingId}</code>
              </dd>
              <dt>Status</dt>
              <dd>{result.status}</dd>
              <dt>Simulated PNR</dt>
              <dd>{result.simulatedPnr ?? '—'}</dd>
              {result.errorCode ? (
                <>
                  <dt>Error code</dt>
                  <dd>{result.errorCode}</dd>
                </>
              ) : null}
            </dl>
          ) : null}
          <p className="row">
            <Link className="button-link" to="/book">
              New booking
            </Link>
            <Link className="button-link secondary-link" to="/search">
              Search again
            </Link>
          </p>
        </>
      )}
    </section>
  );
}
