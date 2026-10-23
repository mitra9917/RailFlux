import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Cloud, Database, Layers, Radio, Server, Workflow } from 'lucide-react';
import { loadStoredToken } from '@/auth/synthetic-auth';
import {
  checkCompareHealth,
  runPairedTc001CompareProbe,
  type ArchitectureProbeResult,
} from '@/lib/compare-api';
import type { JourneyTrace } from '@/lib/journey-trace';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Hop = {
  id: string;
  label: string;
  aws: string;
  icon: 'cloud' | 'layers' | 'server' | 'db' | 'radio' | 'workflow';
};

type HopRuntime = Hop & {
  state: 'idle' | 'active' | 'done' | 'skipped';
  detail?: string;
};

const ICONS = {
  cloud: Cloud,
  layers: Layers,
  server: Server,
  db: Database,
  radio: Radio,
  workflow: Workflow,
};

const BASELINE_HOPS: Hop[] = [
  { id: 'cf', label: 'CloudFront', aws: 'CDN + TLS at the edge', icon: 'cloud' },
  { id: 'alb', label: 'ALB', aws: 'One listener → one target group', icon: 'layers' },
  { id: 'mono', label: 'Monolith ECS', aws: 'Search, availability, book, notify', icon: 'server' },
  { id: 'primary', label: 'RDS Primary', aws: 'Every read and write hits MySQL', icon: 'db' },
  { id: 'pay', label: 'Payment stub', aws: 'In-process on the request thread', icon: 'radio' },
  { id: 'outbox', label: 'Sync outbox', aws: 'Side effect before the HTTP response', icon: 'workflow' },
];

const OPTIMIZED_HOPS: Hop[] = [
  { id: 'cf', label: 'CloudFront', aws: 'Same edge as baseline (fair pair)', icon: 'cloud' },
  { id: 'alb', label: 'ALB', aws: 'Path-routes /search|/availability vs /bookings', icon: 'layers' },
  { id: 'read', label: 'Read ECS', aws: 'Enquiry fleet — isolated from writes', icon: 'server' },
  { id: 'redis', label: 'ElastiCache Redis', aws: 'Cache-aside for advisory seats', icon: 'radio' },
  { id: 'replica', label: 'RDS Replica', aws: 'Cache miss only — never used to book', icon: 'db' },
  { id: 'booking', label: 'Booking ECS', aws: 'Claim inventory on the primary only', icon: 'server' },
  { id: 'primary', label: 'RDS Primary', aws: 'Atomic seat claim + outbox row', icon: 'db' },
  { id: 'pay', label: 'Payment stub', aws: 'Same deterministic stub as baseline', icon: 'radio' },
  { id: 'sqs', label: 'SQS', aws: 'Response returns; notify is async', icon: 'workflow' },
  { id: 'worker', label: 'Worker ECS', aws: 'At-least-once side effect + DLQ', icon: 'server' },
];

type Step = {
  label: string;
  baselineIds: string[];
  optimizedIds: string[];
  baselineMs: number;
  optimizedMs: number;
};

function stepsFromProbe(b: ArchitectureProbeResult, o: ArchitectureProbeResult): Step[] {
  const optMiss = (o.cacheStatus ?? '').toUpperCase() === 'MISS';
  const optSearchHops = ['cf', 'alb', 'read', 'redis', ...(optMiss ? ['replica'] : [])];
  const optAvHops = ['read', 'redis', ...(optMiss ? ['replica'] : [])];
  return [
    {
      label: 'Search',
      baselineIds: ['cf', 'alb', 'mono', 'primary'],
      optimizedIds: optSearchHops,
      baselineMs: b.searchMs,
      optimizedMs: o.searchMs,
    },
    {
      label: 'Availability',
      baselineIds: ['mono', 'primary'],
      optimizedIds: optAvHops,
      baselineMs: b.availabilityMs,
      optimizedMs: o.availabilityMs,
    },
    {
      label: 'Book',
      baselineIds: ['mono', 'primary', 'pay', 'outbox'],
      optimizedIds: ['alb', 'booking', 'primary', 'pay'],
      baselineMs: b.bookingMs,
      optimizedMs: o.bookingMs,
    },
    {
      label: 'After response',
      baselineIds: [],
      optimizedIds: ['sqs', 'worker'],
      baselineMs: 0,
      optimizedMs: Math.max(40, o.bookingMs * 0.12),
    },
  ];
}

function scaleAnim(ms: number): number {
  return Math.min(1800, Math.max(280, ms * 6));
}

function HopIcon({ name, className }: { name: Hop['icon']; className?: string }) {
  const Icon = ICONS[name];
  return <Icon className={className} strokeWidth={2} aria-hidden />;
}

function FlowLane({
  title,
  accent,
  hops,
  cacheLabel,
}: {
  title: string;
  accent: 'baseline' | 'optimized';
  hops: HopRuntime[];
  cacheLabel: string | null;
}) {
  const bar =
    accent === 'optimized'
      ? 'from-emerald-500/90 to-teal-400'
      : 'from-sky-600/90 to-slate-400';
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {cacheLabel ? (
          <Badge
            variant="outline"
            className={cn(
              'font-mono',
              cacheLabel === 'HIT' && 'border-emerald-300 bg-emerald-50 text-emerald-800',
              cacheLabel === 'MISS' && 'border-amber-300 bg-amber-50 text-amber-900',
              cacheLabel === 'BYPASS' && 'border-sky-200 bg-sky-50 text-sky-900',
            )}
          >
            cache {cacheLabel}
          </Badge>
        ) : null}
      </div>
      <ol className="relative flex flex-col gap-2 border-l border-border/80 pl-4">
        {hops.map((hop) => (
          <motion.li
            key={hop.id}
            animate={{
              opacity: hop.state === 'skipped' ? 0.35 : 1,
              scale: hop.state === 'active' ? 1.02 : 1,
            }}
            className={cn(
              'relative rounded-xl border px-3 py-2.5 transition-colors',
              hop.state === 'active' && 'border-primary bg-primary/5 shadow-sm',
              hop.state === 'done' && 'border-border bg-card',
              hop.state === 'idle' && 'border-transparent bg-muted/40',
              hop.state === 'skipped' && 'border-dashed border-border bg-transparent line-through',
            )}
          >
            <span
              className={cn(
                'absolute -left-[21px] top-3.5 size-2.5 rounded-full bg-gradient-to-br',
                hop.state === 'active' || hop.state === 'done' ? bar : 'from-muted-foreground/30 to-muted-foreground/10',
              )}
            />
            <div className="flex items-start gap-2">
              <HopIcon name={hop.icon} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{hop.label}</p>
                <p className="text-xs text-muted-foreground">{hop.detail ?? hop.aws}</p>
              </div>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

function CountUp({ value, suffix = ' ms' }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 700;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      setShown(value * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <span className="font-mono text-2xl font-semibold tabular-nums">
      {shown.toFixed(0)}
      <span className="text-sm font-medium text-muted-foreground">{suffix}</span>
    </span>
  );
}

function MetricCell({
  label,
  baseline,
  optimized,
  win,
}: {
  label: string;
  baseline: number;
  optimized: number;
  win: 'optimized' | 'baseline' | 'tie';
}) {
  const delta = baseline - optimized;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] text-sky-800">Baseline</p>
          <CountUp value={baseline} />
        </div>
        <div>
          <p className="text-[11px] text-emerald-800">Optimized</p>
          <CountUp value={optimized} />
        </div>
      </div>
      <p
        className={cn(
          'mt-2 text-xs font-medium',
          win === 'optimized' && 'text-emerald-700',
          win === 'baseline' && 'text-sky-800',
          win === 'tie' && 'text-muted-foreground',
        )}
      >
        {win === 'optimized'
          ? `Optimized faster by ${delta.toFixed(0)} ms`
          : win === 'baseline'
            ? `Baseline faster by ${(-delta).toFixed(0)} ms`
            : 'Within 5 ms'}
      </p>
    </div>
  );
}

function winnerOf(b: number, o: number): 'optimized' | 'baseline' | 'tie' {
  if (Math.abs(b - o) < 5) return 'tie';
  return o < b ? 'optimized' : 'baseline';
}

function seedHops(list: Hop[], cacheStatus: string | null, architecture: 'baseline' | 'optimized'): HopRuntime[] {
  return list.map((hop) => {
    const skipReplica = architecture === 'optimized' && hop.id === 'replica' && cacheStatus === 'HIT';
    return {
      ...hop,
      state: skipReplica ? 'skipped' : 'idle',
      detail:
        hop.id === 'redis' && cacheStatus
          ? cacheStatus === 'HIT'
            ? 'HIT — seats served from Redis, replica idle'
            : cacheStatus === 'MISS'
              ? 'MISS — read replica, then fill Redis'
              : hop.aws
          : hop.id === 'primary' && architecture === 'baseline'
            ? 'Enquiry and booking share this instance'
            : hop.aws,
    };
  });
}

export function ArchitectureReplay({
  journey,
  pnr,
}: {
  journey: JourneyTrace | null;
  pnr: string | null;
}) {
  const [phase, setPhase] = useState<'idle' | 'measuring' | 'playing' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [baselineHops, setBaselineHops] = useState<HopRuntime[]>(() => seedHops(BASELINE_HOPS, 'BYPASS', 'baseline'));
  const [optimizedHops, setOptimizedHops] = useState<HopRuntime[]>(() => seedHops(OPTIMIZED_HOPS, null, 'optimized'));
  const [probe, setProbe] = useState<{
    baseline: ArchitectureProbeResult;
    optimized: ArchitectureProbeResult;
  } | null>(null);

  const play = useMemo(() => {
    return async () => {
      const token = loadStoredToken();
      if (!token) {
        setError('Sign in on Home so we can measure both stacks with your JWT.');
        setPhase('error');
        return;
      }
      setPhase('measuring');
      setError(null);
      setProbe(null);
      setStepLabel('Checking dual-stack health…');

      const [bOk, oOk] = await Promise.all([
        checkCompareHealth('/compare-baseline'),
        checkCompareHealth('/compare-optimized'),
      ]);
      if (!bOk || !oOk) {
        setError(
          'Need both APIs for a live replay: npm run compare:dual-stack (baseline :3000, optimized :3001).',
        );
        setPhase('error');
        return;
      }

      setStepLabel('Measuring Search → Availability → Book on both architectures…');
      try {
        const result = await runPairedTc001CompareProbe(token);
        setProbe({ baseline: result.baseline, optimized: result.optimized });
        const cache = result.optimized.cacheStatus;
        setBaselineHops(seedHops(BASELINE_HOPS, result.baseline.cacheStatus, 'baseline'));
        setOptimizedHops(seedHops(OPTIMIZED_HOPS, cache, 'optimized'));

        if (!result.baseline.ok || !result.optimized.ok) {
          setError(result.baseline.error || result.optimized.error || 'Probe failed');
          setPhase('error');
          return;
        }

        setPhase('playing');
        const steps = stepsFromProbe(result.baseline, result.optimized);
        for (const step of steps) {
          setStepLabel(step.label);
          const idsB = new Set(step.baselineIds);
          const idsO = new Set(step.optimizedIds);
          setBaselineHops((prev) =>
            prev.map((h) => ({ ...h, state: idsB.has(h.id) ? 'active' : h.state === 'skipped' ? 'skipped' : h.state })),
          );
          setOptimizedHops((prev) =>
            prev.map((h) => ({
              ...h,
              state: idsO.has(h.id) ? 'active' : h.state === 'skipped' ? 'skipped' : h.state,
            })),
          );
          await new Promise((r) => setTimeout(r, scaleAnim(Math.max(step.baselineMs, step.optimizedMs, 80))));
          setBaselineHops((prev) =>
            prev.map((h) => ({
              ...h,
              state: idsB.has(h.id) ? 'done' : h.state,
            })),
          );
          setOptimizedHops((prev) =>
            prev.map((h) => ({
              ...h,
              state: idsO.has(h.id) ? 'done' : h.state,
            })),
          );
        }
        setStepLabel(null);
        setPhase('done');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Replay failed');
        setPhase('error');
      }
    };
  }, []);

  useEffect(() => {
    void play();
  }, [play]);

  const optWin =
    probe && probe.baseline.ok && probe.optimized.ok
      ? winnerOf(probe.baseline.totalMs, probe.optimized.totalMs)
      : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-muted/40 to-background p-5 sm:p-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Live architecture</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">How this booking moved through AWS</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            PNR {pnr ? <code className="font-mono">{pnr}</code> : '—'} is your ticket. The lanes below are a{' '}
            <strong className="font-medium text-foreground">fresh paired measurement</strong> of the same Tatkal
            case on baseline vs optimized — not canned numbers.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void play()} disabled={phase === 'measuring' || phase === 'playing'}>
          Replay
        </Button>
      </header>

      {journey && (journey.searchMs || journey.bookingMs) ? (
        <p className="mb-4 text-xs text-muted-foreground">
          Your browser hop for this ticket
          {journey.searchMs != null ? ` · search ${journey.searchMs.toFixed(0)} ms` : ''}
          {journey.availabilityMs != null ? ` · availability ${journey.availabilityMs.toFixed(0)} ms` : ''}
          {journey.cacheStatus ? ` · cache ${journey.cacheStatus}` : ''}
          {journey.bookingMs != null ? ` · book ${journey.bookingMs.toFixed(0)} ms` : ''}
        </p>
      ) : null}

      {phase === 'measuring' || phase === 'playing' ? (
        <p className="mb-4 text-sm text-muted-foreground">{stepLabel ?? 'Working…'}</p>
      ) : null}
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <FlowLane title="Baseline — monolith" accent="baseline" hops={baselineHops} cacheLabel={probe?.baseline.cacheStatus ?? 'BYPASS'} />
        <FlowLane
          title="Optimized — split + cache + queue"
          accent="optimized"
          hops={optimizedHops}
          cacheLabel={probe?.optimized.cacheStatus ?? null}
        />
      </div>

      {phase === 'done' && probe ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 space-y-4"
        >
          <div
            className={cn(
              'rounded-2xl border px-4 py-3 text-sm font-medium',
              optWin === 'optimized'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : 'border-border bg-muted/60',
            )}
          >
            {optWin === 'optimized'
              ? `Optimized won this replay — ${probe.optimized.totalMs.toFixed(0)} ms vs baseline ${probe.baseline.totalMs.toFixed(0)} ms. Cache ${probe.optimized.cacheStatus ?? '—'} on the read path; booking still committed on the primary, notify via SQS.`
              : `This run: baseline ${probe.baseline.totalMs.toFixed(0)} ms · optimized ${probe.optimized.totalMs.toFixed(0)} ms (cache ${probe.optimized.cacheStatus ?? '—'}). Replay after a warm cache to see the HIT path skip the replica.`}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCell
              label="Search"
              baseline={probe.baseline.searchMs}
              optimized={probe.optimized.searchMs}
              win={winnerOf(probe.baseline.searchMs, probe.optimized.searchMs)}
            />
            <MetricCell
              label="Availability"
              baseline={probe.baseline.availabilityMs}
              optimized={probe.optimized.availabilityMs}
              win={winnerOf(probe.baseline.availabilityMs, probe.optimized.availabilityMs)}
            />
            <MetricCell
              label="Book (sync path)"
              baseline={probe.baseline.bookingMs}
              optimized={probe.optimized.bookingMs}
              win={winnerOf(probe.baseline.bookingMs, probe.optimized.bookingMs)}
            />
            <MetricCell
              label="End-to-end"
              baseline={probe.baseline.totalMs}
              optimized={probe.optimized.totalMs}
              win={winnerOf(probe.baseline.totalMs, probe.optimized.totalMs)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            HIT: Redis answers advisory seats. MISS: Read ECS fills from the replica, then Redis. BYPASS: baseline never
            caches. Booking never reads Redis or the replica — CloudFront, ALB, ECS, ElastiCache, RDS, SQS are the real
            split we deploy on AWS.
          </p>
        </motion.div>
      ) : null}
    </section>
  );
}
