import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

function useCycle(periodMs: number): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setT(0.45);
      return;
    }
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      setT(((now - start) % periodMs) / periodMs);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [periodMs]);
  return t;
}

type Tone = 'client' | 'edge' | 'app' | 'data' | 'queue';

const TONE: Record<Tone, string> = {
  client: 'bg-orange-50 border-orange-200/80',
  edge: 'bg-sky-50 border-sky-200/80',
  app: 'bg-amber-50 border-amber-200/80',
  data: 'bg-emerald-50 border-emerald-200/80',
  queue: 'bg-violet-50 border-violet-200/80',
};

function Node({
  title,
  sub,
  tone,
  active,
}: {
  title: string;
  sub: string;
  tone: Tone;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        'relative mx-auto w-[min(100%,20rem)] rounded-full border px-5 py-3 text-center transition-[box-shadow,transform] duration-300',
        TONE[tone],
        active && 'z-10 scale-[1.02] shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_0_28px_rgba(37,99,235,0.35)]',
      )}
    >
      {active ? (
        <span className="absolute inset-0 rounded-full bg-sky-400/15 blur-md" aria-hidden />
      ) : null}
      <p className="relative text-[13px] font-medium leading-tight tracking-tight">{title}</p>
      <p className="relative mt-0.5 text-[11px] leading-snug text-muted-foreground">{sub}</p>
    </div>
  );
}

function Stem({ active }: { active: boolean }) {
  return (
    <div className="relative mx-auto h-10 w-px bg-border">
      <span
        className={cn(
          'absolute left-1/2 top-0 size-1.5 -translate-x-1/2 rounded-full bg-sky-500 opacity-0 shadow-[0_0_10px_2px_rgba(56,189,248,0.85)]',
          active && 'opacity-100 animate-[flow-dot_0.7s_linear]',
        )}
      />
    </div>
  );
}

function phase(t: number, start: number, end: number): boolean {
  return t >= start && t < end;
}

export function BaselineFlow({ t }: { t: number }) {
  const steps = [
    { title: 'Client', sub: 'k6 or React booking UI', tone: 'client' as const },
    { title: 'Amazon CloudFront', sub: 'Edge CDN', tone: 'edge' as const },
    { title: 'AWS WAF', sub: 'Optional, cell-controlled', tone: 'edge' as const },
    { title: 'Application Load Balancer', sub: 'One listener, one target', tone: 'edge' as const },
    { title: 'Monolith API', sub: 'Search · book · payment · notify', tone: 'app' as const },
    { title: 'MySQL primary', sub: 'Amazon RDS · one authoritative DB', tone: 'data' as const },
  ];
  const i = Math.min(steps.length - 1, Math.floor(t * steps.length));
  const onDbLoop = t > 0.72;

  return (
    <article>
      <p className="mb-8 text-[13px] text-muted-foreground">Fig 2.1 · Baseline · fixed-capacity monolith</p>
      <div className="flex flex-col items-center">
        {steps.map((step, idx) => (
          <div key={step.title} className="flex w-full flex-col items-center">
            {idx > 0 ? <Stem active={i === idx || (onDbLoop && idx === 5)} /> : null}
            <Node {...step} active={i === idx || (onDbLoop && (idx === 4 || idx === 5))} />
          </div>
        ))}
      </div>
      <p className="mx-auto mt-8 max-w-xs text-center text-[12px] leading-relaxed text-muted-foreground">
        Reads, bookings, payment, and side effects share one request path and one database.
      </p>
    </article>
  );
}

export function OptimizedFlow({ t }: { t: number }) {
  const edge = [
    { title: 'Client', sub: 'k6 or React booking UI', tone: 'client' as const },
    { title: 'Amazon CloudFront', sub: 'Edge CDN', tone: 'edge' as const },
    { title: 'AWS WAF', sub: 'Cell-controlled', tone: 'edge' as const },
    { title: 'Application Load Balancer', sub: 'Path-routes reads vs bookings', tone: 'edge' as const },
  ];
  const edgeIndex = t < 0.32 ? Math.floor((t / 0.32) * edge.length) : -1;
  const split = t >= 0.32;
  const readActive = split && t < 0.66;
  const writeActive = split && t >= 0.5;
  const cacheHit = t >= 0.38 && t < 0.5;
  const cacheMiss = t >= 0.5 && t < 0.66;
  const onPrimary = t >= 0.58 && t < 0.78;
  const onSqs = t >= 0.72 && t < 0.86;
  const onWorker = t >= 0.84;

  return (
    <article>
      <p className="mb-8 text-[13px] text-muted-foreground">Fig 2.2 · Optimized · read / write separated</p>
      <div className="flex flex-col items-center">
        {edge.map((step, idx) => (
          <div key={step.title} className="flex w-full flex-col items-center">
            {idx > 0 ? <Stem active={edgeIndex === idx} /> : null}
            <Node {...step} active={edgeIndex === idx} />
          </div>
        ))}
        <div className="relative my-2 h-12 w-full max-w-md">
          <span className="absolute left-1/4 top-0 h-full w-px bg-border" />
          <span className="absolute right-1/4 top-0 h-full w-px bg-border" />
          <span
            className={cn(
              'absolute top-0 size-1.5 -translate-x-1/2 rounded-full bg-sky-500 opacity-0 shadow-[0_0_10px_2px_rgba(56,189,248,0.85)]',
              readActive && 'left-1/4 opacity-100',
            )}
          />
          <span
            className={cn(
              'absolute top-0 size-1.5 -translate-x-1/2 rounded-full bg-violet-500 opacity-0 shadow-[0_0_10px_2px_rgba(139,92,246,0.85)]',
              writeActive && 'left-3/4 opacity-100',
            )}
          />
        </div>
        <div className="grid w-full max-w-xl grid-cols-2 gap-6">
          <div className="flex flex-col items-center">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Search / availability</p>
            <Node title="Read service" sub="ECS Fargate" tone="app" active={readActive && !cacheMiss} />
            <Stem active={cacheHit || cacheMiss} />
            <Node
              title="ElastiCache Redis"
              sub={cacheHit ? 'HIT · advisory seats' : 'Non-authoritative cache'}
              tone="queue"
              active={cacheHit}
            />
            <Stem active={cacheMiss} />
            <Node
              title="RDS read replica"
              sub={cacheMiss ? 'MISS · then fill Redis' : 'Non-authoritative reads'}
              tone="data"
              active={cacheMiss}
            />
          </div>
          <div className="flex flex-col items-center">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Booking</p>
            <Node title="Booking service" sub="ECS Fargate" tone="app" active={writeActive && t < 0.72} />
            <Stem active={onPrimary} />
            <Node title="RDS primary" sub="Authoritative for bookings" tone="data" active={onPrimary} />
            <Stem active={onSqs} />
            <Node title="SQS + DLQ" sub="Side-effect queue" tone="queue" active={onSqs} />
            <Stem active={onWorker} />
            <Node title="Worker service" sub="Async notify · at-least-once" tone="app" active={onWorker} />
          </div>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-sm text-center text-[12px] leading-relaxed text-muted-foreground">
        Booking commits on the primary. Notify leaves the request path. Replica is never used to sell a seat.
      </p>
    </article>
  );
}

export function ArchitectureFlows() {
  const t = useCycle(9000);
  const label = phase(t, 0, 0.32)
    ? 'Ingress'
    : phase(t, 0.32, 0.66)
      ? 'Enquiry'
      : 'Commit + notify';

  return (
    <div className="space-y-10">
      <p className="text-[13px] text-muted-foreground">
        Live path <span className="font-medium text-foreground">{label}</span>
      </p>
      <div className="grid gap-16 xl:grid-cols-2">
        <BaselineFlow t={t} />
        <OptimizedFlow t={t} />
      </div>
    </div>
  );
}
