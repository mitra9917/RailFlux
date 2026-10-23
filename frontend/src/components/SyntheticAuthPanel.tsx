import { useCallback, useEffect, useState } from 'react';
import { getDevJwtSecret, getSyntheticUserId } from '@/config/env';
import {
  clearStoredToken,
  loadStoredToken,
  mintSyntheticSession,
  storeToken,
  type SyntheticSession,
} from '@/auth/synthetic-auth';
import { AppCard } from '@/components/app/AppCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Props = {
  onSessionChange: (session: SyntheticSession | null) => void;
  /** Glass card on hero background */
  immersive?: boolean;
  cardClassName?: string;
};

export function SyntheticAuthPanel({ onSessionChange, immersive, cardClassName }: Props) {
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

  const fieldShell = immersive
    ? '[&_label]:text-slate-200 [&_input]:border-white/20 [&_input]:bg-slate-950/40 [&_input]:text-slate-50 [&_textarea]:border-white/20 [&_textarea]:bg-slate-950/40 [&_textarea]:text-slate-50'
    : '';

  return (
    <AppCard
      title="Synthetic sign-in"
      subtitle="Academic simulator only — fixture UUIDs and npm run mint:jwt. Never real IRCTC or payment credentials."
      className={cn(
        immersive &&
          'border-white/15 bg-slate-950/55 text-slate-100 shadow-2xl backdrop-blur-xl [&_[data-slot=card-description]]:text-slate-300',
        fieldShell,
        cardClassName,
      )}
    >
      {session ? (
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3',
            immersive ? 'bg-emerald-500/15 text-emerald-50' : 'bg-accent/60',
          )}
        >
          <span className="text-sm">
            Signed in as <code className="font-mono text-xs">{session.userId}</code>
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="synthetic-user">Synthetic user UUID</Label>
            <Input
              id="synthetic-user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <Button type="button" onClick={() => void signInWithDevSecret()}>
            Mint dev JWT
          </Button>
          <div className="space-y-2">
            <Label htmlFor="paste-jwt">Or paste JWT</Label>
            <textarea
              id="paste-jwt"
              className="flex min-h-[4rem] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={pasteToken}
              onChange={(e) => setPasteToken(e.target.value)}
              placeholder="Bearer token from mint:jwt"
            />
          </div>
          <Button type="button" variant="secondary" onClick={applyPastedToken}>
            Use pasted token
          </Button>
        </div>
      )}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </AppCard>
  );
}
