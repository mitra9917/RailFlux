import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, RefreshCw } from 'lucide-react';
import { MetricsComparePanel } from '@/components/MetricsComparePanel';
import { SyntheticAuthPanel } from '@/components/SyntheticAuthPanel';
import { loadStoredToken } from '@/auth/synthetic-auth';
import {
  checkCompareHealth,
  fetchCompareK6Status,
  runLiveK6Compare,
  type LiveK6CompareResult,
} from '@/lib/compare-api';
import { AppCard } from '@/components/app/AppCard';
import { PageShell } from '@/components/app/PageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const BASELINE_PREFIX = '/compare-baseline' as const;
const OPTIMIZED_PREFIX = '/compare-optimized' as const;

export function ComparePage() {
  const [baselineUp, setBaselineUp] = useState<boolean | null>(null);
  const [optimizedUp, setOptimizedUp] = useState<boolean | null>(null);
  const [k6Ready, setK6Ready] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LiveK6CompareResult | null>(null);
  const [hasToken, setHasToken] = useState(() => Boolean(loadStoredToken()));

  const refreshHealth = useCallback(async () => {
    const [b, o, k6] = await Promise.all([
      checkCompareHealth(BASELINE_PREFIX),
      checkCompareHealth(OPTIMIZED_PREFIX),
      fetchCompareK6Status(),
    ]);
    setBaselineUp(b);
    setOptimizedUp(o);
    setK6Ready(k6.k6);
    return { baseline: b, optimized: o, k6: k6.k6, busy: k6.busy };
  }, []);

  const runCompare = useCallback(async () => {
    const token = loadStoredToken();
    if (!token) {
      setHasToken(false);
      setError('Sign in (Mint dev JWT) before generating traffic.');
      return;
    }
    setHasToken(true);
    setError(null);
    setRunning(true);
    try {
      const next = await runLiveK6Compare(token);
      setResult(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'k6 compare failed');
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  const ready = baselineUp && optimizedUp && k6Ready;

  return (
    <PageShell
      wide
      title="Experiments"
      lead="Live k6 burst against baseline :3000 and optimized :3001. Same mix, same seconds."
    >
      <AppCard title="Generate traffic">
        <p className="text-sm text-muted-foreground">
          Runs <code className="font-mono text-xs">compare-burst.js</code> (PT-005 70/20/10) for 8s
          at 12 req/s on each stack. Numbers below are from that run — not a static JSON file.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <HealthBadge label="Baseline" up={baselineUp} />
          <HealthBadge label="Optimized" up={optimizedUp} />
          <HealthBadge label="k6" up={k6Ready} />
          <Button type="button" variant="secondary" size="sm" onClick={() => void refreshHealth()}>
            <RefreshCw className="size-3.5" />
            Recheck
          </Button>
        </div>

        {!hasToken ? (
          <div className="mt-4 max-w-md">
            <SyntheticAuthPanel
              onSessionChange={(s) => {
                setHasToken(Boolean(s));
                if (s) void runCompare();
              }}
            />
          </div>
        ) : null}

        {k6Ready === false ? (
          <p className="mt-4 text-sm text-destructive">
            k6 is not on PATH. Install with <code className="font-mono text-xs">brew install k6</code>.
          </p>
        ) : null}
        {baselineUp === false || optimizedUp === false ? (
          <p className="mt-4 text-sm text-destructive">
            Dual stack is down. Start{' '}
            <code className="font-mono text-xs">npm run compare:dual-stack</code>.
          </p>
        ) : null}

        <Button
          type="button"
          className="mt-4"
          disabled={running || !ready || !hasToken}
          onClick={() => void runCompare()}
        >
          <Play className="size-4" />
          {running ? 'k6 running on both stacks…' : result ? 'Run again' : 'Run live k6 compare'}
        </Button>
        {running ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Generating traffic now (~8–12s). Baseline and optimized are hit in parallel.
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <p className="mt-4 text-xs text-muted-foreground">
          Needs <Link to="/">a minted JWT</Link> and this machine running Vite + both APIs.
        </p>
      </AppCard>

      {result ? <MetricsComparePanel data={result} /> : null}
    </PageShell>
  );
}

function HealthBadge({ label, up }: { label: string; up: boolean | null }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      {label}{' '}
      {up === null ? (
        <Badge variant="outline">…</Badge>
      ) : up ? (
        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">up</Badge>
      ) : (
        <Badge variant="destructive">down</Badge>
      )}
    </span>
  );
}
