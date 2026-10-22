import { useState } from 'react';
import { fetchLiveHealth } from '../api/client';
import type { SyntheticSession } from '../auth/synthetic-auth';
import { SyntheticAuthPanel } from '../components/SyntheticAuthPanel';

export function HomePage() {
  const [session, setSession] = useState<SyntheticSession | null>(null);
  const [health, setHealth] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  async function checkHealth() {
    setHealthError(null);
    setHealth(null);
    try {
      const result = await fetchLiveHealth();
      setHealth(result.ok ? `live ${result.status}` : `unhealthy ${result.status}`);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Health check failed');
    }
  }

  return (
    <>
      <SyntheticAuthPanel onSessionChange={setSession} />
      <section className="panel">
        <h2>Connectivity</h2>
        <p className="muted">
          Dev server proxies <code>/health/*</code> and <code>/v1/*</code> to your local API (port 3000).
        </p>
        <button type="button" onClick={() => void checkHealth()}>
          Ping /health/live
        </button>
        {health ? <p className="success">Backend: {health}</p> : null}
        {healthError ? <p className="error">{healthError}</p> : null}
        {session ? (
          <p className="muted">
            Signed in — open <strong>Search</strong> to run TC-001 flows against the live API.
          </p>
        ) : null}
      </section>
    </>
  );
}
