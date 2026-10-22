import { useState } from 'react';
import { fetchLiveHealth } from './api/client';
import type { SyntheticSession } from './auth/synthetic-auth';
import { SyntheticAuthPanel } from './components/SyntheticAuthPanel';
import { getApiBaseUrl } from './config/env';

export default function App() {
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
    <div className="app">
      <header>
        <h1>RailFlux booking simulator</h1>
        <p className="muted">
          API base: <code>{getApiBaseUrl()}</code>
        </p>
      </header>

      <SyntheticAuthPanel onSessionChange={setSession} />

      <section className="panel">
        <h2>Connectivity</h2>
        <button type="button" onClick={() => void checkHealth()}>
          Ping /health/live
        </button>
        {health ? <p>Backend: {health}</p> : null}
        {healthError ? <p className="error">{healthError}</p> : null}
        {session ? (
          <p className="muted">Authenticated API flows ship in M8 #72–#73.</p>
        ) : null}
      </section>
    </div>
  );
}
