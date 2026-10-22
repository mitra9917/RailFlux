import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { getAvailability, type AvailabilityParams } from '../api/search';
import type { Availability, TravelClass } from '@railflux/shared/api-types';

const CLASSES: TravelClass[] = ['SL', '3A', '2A'];

function parseParams(search: URLSearchParams): AvailabilityParams | null {
  const trainRunId = search.get('trainRunId')?.trim();
  const travelClass = search.get('class')?.trim() as TravelClass | undefined;
  const quota = search.get('quota')?.trim();
  if (!trainRunId || !travelClass || quota !== 'TATKAL') return null;
  if (!CLASSES.includes(travelClass)) return null;
  return { trainRunId, class: travelClass, quota: 'TATKAL' };
}

export function AvailabilityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [travelClass, setTravelClass] = useState<TravelClass>(
    (searchParams.get('class') as TravelClass) || '3A',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);

  const trainRunId = searchParams.get('trainRunId')?.trim() ?? '';

  useEffect(() => {
    const params = parseParams(searchParams);
    if (!params) {
      setAvailability(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void getAvailability(params)
      .then((data) => {
        if (!cancelled) setAvailability(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(
            err.errorCode === 'VALIDATION_ERROR'
              ? `Validation: ${err.message}`
              : `${err.message} (${err.status})`,
          );
        } else {
          setError(err instanceof Error ? err.message : 'Availability failed');
        }
        setAvailability(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  function applyClass(next: TravelClass) {
    setTravelClass(next);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('class', next);
    nextParams.set('quota', 'TATKAL');
    setSearchParams(nextParams);
  }

  return (
    <section className="panel">
      <h2>Availability</h2>
      {!trainRunId ? (
        <p className="error">
          Missing train run — start from <Link to="/search">Search</Link>.
        </p>
      ) : (
        <>
          <p className="muted">
            Run <code>{trainRunId}</code> · displayed seats are advisory (not authoritative inventory).
          </p>
          <div className="class-tabs" role="tablist" aria-label="Travel class">
            {CLASSES.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={travelClass === c}
                className={travelClass === c ? 'tab active' : 'tab'}
                onClick={() => applyClass(c)}
              >
                {c}
              </button>
            ))}
          </div>
          {loading ? <p className="muted">Loading…</p> : null}
          {error ? <p className="error">{error}</p> : null}
          {availability ? (
            <div className="availability-card">
              <p className="availability-count">{availability.displayedSeats} seats shown</p>
              <p className="muted">
                Cache {availability.freshness.cacheStatus} · observed{' '}
                {new Date(availability.freshness.observedAt).toLocaleString()}
              </p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
