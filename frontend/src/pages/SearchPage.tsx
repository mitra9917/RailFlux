import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { searchTrains } from '../api/search';
import type { TrainRun } from '@railflux/shared/api-types';

const DEFAULT_FROM = 'SAB';
const DEFAULT_TO = 'SAA';
const DEFAULT_DATE = '2026-04-01';

export function SearchPage() {
  const [from, setFrom] = useState(DEFAULT_FROM);
  const [to, setTo] = useState(DEFAULT_TO);
  const [date, setDate] = useState(DEFAULT_DATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TrainRun[]>([]);
  const [freshnessNote, setFreshnessNote] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setItems([]);
    setFreshnessNote(null);
    try {
      const data = await searchTrains({ from, to, date });
      setItems(data.items);
      setFreshnessNote(
        data.freshness?.authoritative === false
          ? `Advisory listing · cache ${data.freshness.cacheStatus}`
          : null,
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.errorCode === 'VALIDATION_ERROR'
            ? `Validation: ${err.message}`
            : `${err.message} (${err.status})`,
        );
      } else {
        setError(err instanceof Error ? err.message : 'Search failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <h2>Search trains</h2>
      <p className="muted">Fixture-friendly defaults (SAB → SAA, 2026-04-01). Sign in on Home first.</p>
      <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
        <label className="field">
          From
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value.toUpperCase())}
            maxLength={3}
            required
            pattern="[A-Z]{3}"
            title="Three-letter station code"
          />
        </label>
        <label className="field">
          To
          <input
            value={to}
            onChange={(e) => setTo(e.target.value.toUpperCase())}
            maxLength={3}
            required
            pattern="[A-Z]{3}"
          />
        </label>
        <label className="field">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {freshnessNote ? <p className="muted">{freshnessNote}</p> : null}
      {items.length > 0 ? (
        <ul className="result-list">
          {items.map((run) => (
            <li key={run.trainRunId}>
              <div>
                <strong>{run.trainNo}</strong> {run.name}
                <span className="muted block">
                  {run.from} → {run.to} · {run.date}
                </span>
              </div>
              <Link
                className="button-link"
                to={`/availability?trainRunId=${encodeURIComponent(run.trainRunId)}&class=3A&quota=TATKAL`}
              >
                Availability
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <p className="muted">No results yet — run a search.</p>
      ) : null}
    </section>
  );
}
