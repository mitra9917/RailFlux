import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MetricsComparePanel,
  type DashboardData,
} from '../components/MetricsComparePanel';
import { loadStoredToken } from '../auth/synthetic-auth';
import {
  checkCompareHealth,
  probeArchitectureBooking,
  type ArchitectureProbeResult,
} from '../lib/compare-api';
import { generateIdempotencyKey } from '../lib/idempotency-key';

const BASELINE_PREFIX = '/compare-baseline' as const;
const OPTIMIZED_PREFIX = '/compare-optimized' as const;

export function ComparePage() {
  const [metrics, setMetrics] = useState<DashboardData | null>(null);
  const [metricsNote, setMetricsNote] = useState('Loading metrics…');
  const [baselineUp, setBaselineUp] = useState<boolean | null>(null);
  const [optimizedUp, setOptimizedUp] = useState<boolean | null>(null);
  const [baselineProbe, setBaselineProbe] = useState<ArchitectureProbeResult | null>(null);
  const [optimizedProbe, setOptimizedProbe] = useState<ArchitectureProbeResult | null>(null);
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/comparison-data.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: DashboardData) => {
        setMetrics(data);
        setMetricsNote(
          'Loaded comparison-data.json. Replace frontend/public/comparison-data.json with experiment/dashboard/output/*-dashboard.json after your campaign.',
        );
      })
      .catch(() => {
        setMetricsNote('Could not load comparison-data.json');
      });
  }, []);

  const refreshHealth = useCallback(async () => {
    const [b, o] = await Promise.all([
      checkCompareHealth(BASELINE_PREFIX),
      checkCompareHealth(OPTIMIZED_PREFIX),
    ]);
    setBaselineUp(b);
    setOptimizedUp(o);
  }, []);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  async function runSideBySideProbe() {
    const token = loadStoredToken();
    if (!token) {
      setProbeError('Sign in on Home first (Mint dev JWT).');
      return;
    }
    setProbeError(null);
    setProbing(true);
    setBaselineProbe(null);
    setOptimizedProbe(null);
    try {
      const bKey = generateIdempotencyKey();
      const oKey = generateIdempotencyKey();
      const b = await probeArchitectureBooking('baseline', BASELINE_PREFIX, token, bKey);
      setBaselineProbe(b);
      const o = await probeArchitectureBooking('optimized', OPTIMIZED_PREFIX, token, oKey);
      setOptimizedProbe(o);
      if (!b.ok && !o.ok) {
        setProbeError('Both probes failed — start dual stack (see instructions below).');
      }
    } finally {
      setProbing(false);
    }
  }

  return (
    <>
      <section className="panel">
        <h2>Baseline vs optimized</h2>
        <p>
          Side-by-side view for submission: <strong>paired load-test metrics</strong> (experiment) and{' '}
          <strong>live Tatkal booking probes</strong> (same TC-001 flow on each architecture).
        </p>
        <p className="muted">
          Synthetic RailFlux architectures — not IRCTC production. Metrics come from paired k6 runs; live
          probes show cache path and booking latency on your machine.
        </p>
      </section>

      {metrics ? (
        <MetricsComparePanel data={metrics} dataSourceNote={metricsNote} />
      ) : (
        <section className="panel">
          <p className="muted">{metricsNote}</p>
        </section>
      )}

      <section className="panel compare-live">
        <h2>Live booking probe (same test case)</h2>
        <p className="muted">
          Runs Search → Availability (3A Tatkal) → Book for <strong>baseline</strong> (:3000) and{' '}
          <strong>optimized</strong> (:3001) in parallel. Requires{' '}
          <code>npm run compare:dual-stack</code> and sign-in on <Link to="/">Home</Link>.
        </p>
        <p className="row compare-health">
          <span>
            Baseline API{' '}
            {baselineUp === null ? '…' : baselineUp ? <span className="success">up</span> : <span className="error">down</span>}
          </span>
          <span>
            Optimized API{' '}
            {optimizedUp === null ? '…' : optimizedUp ? <span className="success">up</span> : <span className="error">down</span>}
          </span>
          <button type="button" className="secondary" onClick={() => void refreshHealth()}>
            Refresh status
          </button>
        </p>
        <button type="button" disabled={probing} onClick={() => void runSideBySideProbe()}>
          {probing ? 'Running probes…' : 'Run side-by-side booking probe'}
        </button>
        {probeError ? <p className="error">{probeError}</p> : null}

        <div className="compare-columns">
          <ProbeCard title="Baseline (monolith)" result={baselineProbe} />
          <ProbeCard title="Optimized (read/cache + booking + queue)" result={optimizedProbe} />
        </div>

        <details className="compare-setup">
          <summary>Start both APIs locally (submission demo)</summary>
          <pre className="setup-pre">{`npm run compare:dual-stack
# In another terminal:
npm run dev:frontend
# Home → Mint JWT → open Compare → Run probe`}</pre>
          <p className="muted">
            To use real campaign numbers: copy{' '}
            <code>experiment/dashboard/output/&lt;campaign&gt;-dashboard.json</code> to{' '}
            <code>frontend/public/comparison-data.json</code> and refresh.
          </p>
        </details>
      </section>
    </>
  );
}

function ProbeCard({ title, result }: { title: string; result: ArchitectureProbeResult | null }) {
  return (
    <div className="compare-card">
      <h3>{title}</h3>
      {!result ? (
        <p className="muted">No probe yet.</p>
      ) : result.ok ? (
        <dl className="status-dl">
          <dt>Total</dt>
          <dd>{result.totalMs.toFixed(0)} ms</dd>
          <dt>Search</dt>
          <dd>{result.searchMs.toFixed(0)} ms</dd>
          <dt>Availability</dt>
          <dd>
            {result.availabilityMs.toFixed(0)} ms · cache {result.cacheStatus ?? '—'}
          </dd>
          <dt>Book</dt>
          <dd>{result.bookingMs.toFixed(0)} ms</dd>
          <dt>Status</dt>
          <dd>{result.bookingStatus}</dd>
          <dt>PNR</dt>
          <dd>{result.simulatedPnr ?? '—'}</dd>
        </dl>
      ) : (
        <p className="error">{result.error}</p>
      )}
    </div>
  );
}
