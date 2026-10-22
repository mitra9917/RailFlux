import { useCallback, useEffect, useState } from 'react';
import { getDevJwtSecret, getSyntheticUserId } from '../config/env';
import {
  clearStoredToken,
  loadStoredToken,
  mintSyntheticSession,
  storeToken,
  type SyntheticSession,
} from '../auth/synthetic-auth';

type Props = {
  onSessionChange: (session: SyntheticSession | null) => void;
};

export function SyntheticAuthPanel({ onSessionChange }: Props) {
  const [userId, setUserId] = useState(getSyntheticUserId());
  const [pasteToken, setPasteToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SyntheticSession | null>(null);

  const syncFromStorage = useCallback(() => {
    const token = loadStoredToken();
    if (token) {
      const next: SyntheticSession = {
        userId,
        cohort: 'browser',
        token,
      };
      setSession(next);
      onSessionChange(next);
    } else {
      setSession(null);
      onSessionChange(null);
    }
  }, [onSessionChange, userId]);

  useEffect(() => {
    syncFromStorage();
  }, [syncFromStorage]);

  async function signInWithDevSecret() {
    setError(null);
    const secret = getDevJwtSecret();
    if (!secret) {
      setError('Set VITE_SYNTHETIC_JWT_SECRET or paste a token from npm run mint:jwt.');
      return;
    }
    try {
      const next = await mintSyntheticSession({ userId, secret, cohort: 'browser' });
      setSession(next);
      onSessionChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mint synthetic JWT.');
    }
  }

  function applyPastedToken() {
    setError(null);
    const token = pasteToken.trim();
    if (!token) {
      setError('Paste a bearer token from npm run mint:jwt.');
      return;
    }
    storeToken(token);
    syncFromStorage();
    setPasteToken('');
  }

  function signOut() {
    clearStoredToken();
    setSession(null);
    onSessionChange(null);
  }

  return (
    <section className="panel auth-panel" aria-labelledby="auth-heading">
      <h2 id="auth-heading">Synthetic sign-in</h2>
      <p className="muted">
        Academic simulator only — use fixture UUIDs and{' '}
        <code>npm run mint:jwt</code>; never real IRCTC or payment credentials.
      </p>
      {session ? (
        <p>
          Signed in as <code>{session.userId}</code> ({session.cohort})
          <button type="button" className="linkish" onClick={signOut}>
            Sign out
          </button>
        </p>
      ) : (
        <>
          <label className="field">
            Synthetic user UUID
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="row">
            <button type="button" onClick={() => void signInWithDevSecret()}>
              Mint dev JWT
            </button>
          </div>
          <label className="field">
            Or paste JWT
            <textarea
              value={pasteToken}
              onChange={(e) => setPasteToken(e.target.value)}
              rows={2}
              placeholder="Bearer token from mint:jwt"
            />
          </label>
          <button type="button" onClick={applyPastedToken}>
            Use pasted token
          </button>
        </>
      )}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
