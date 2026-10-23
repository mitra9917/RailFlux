import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { getAvailability } from '@/api/search';
import { Button } from '@/components/ui/button';
import { CLASS_LABEL } from '@/lib/travel-copy';
import type { JourneyTrace } from '@/lib/journey-trace';
import type { TravelClass } from '@railflux/shared/api-types';
import { cn } from '@/lib/utils';

const CLASSES: TravelClass[] = ['SL', '3A', '2A'];
const BURST = 40;
const BOT_SHARE = 0.2;
const DURATION_MS = 9200;

const LAYERS = [
  { id: 'net', label: 'Burst', sub: 'Open window', nodes: 6 },
  { id: 'cf', label: 'CloudFront', sub: 'TLS at the edge', nodes: 6 },
  { id: 'waf', label: 'AWS WAF', sub: 'Rate + managed rules', nodes: 6 },
  { id: 'alb', label: 'ALB', sub: 'Path to /bookings', nodes: 5 },
  { id: 'ecs', label: 'Booking ECS', sub: 'Auth · idempotency', nodes: 5 },
  { id: 'rds', label: 'RDS primary', sub: 'Atomic seat claim', nodes: 4 },
  { id: 'inv', label: 'Inventory', sub: 'This bucket vs others', nodes: 3 },
] as const;

type Kind = 'you' | 'genuine' | 'bot';
type Fate = 'win' | 'reroute' | 'drop';

type Particle = {
  id: number;
  kind: Kind;
  fate: Fate;
  delay: number;
  nodes: number[];
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildParticles(seed: string): Particle[] {
  const rng = mulberry32(seedFrom(seed));
  const botCount = Math.round(BURST * BOT_SHARE);
  const out: Particle[] = [];
  for (let i = 0; i < BURST; i += 1) {
    const kind: Kind = i === 0 ? 'you' : i <= botCount ? 'bot' : 'genuine';
    const fate: Fate = kind === 'you' ? 'win' : kind === 'bot' ? 'drop' : 'reroute';
    const nodes = LAYERS.map((layer, li) => {
      if (li === LAYERS.length - 1) {
        if (fate === 'win') return 0;
        if (fate === 'reroute') return rng() < 0.5 ? 1 : 2;
        return Math.floor(rng() * layer.nodes);
      }
      return Math.floor(rng() * layer.nodes);
    });
    out.push({
      id: i,
      kind,
      fate,
      delay: rng() * 0.18,
      nodes,
    });
  }
  return out;
}

function nodePoint(layer: number, node: number, nodeCount: number): { x: number; y: number } {
  const x = 70 + layer * 143;
  const span = 260;
  const top = 40;
  const y = nodeCount <= 1 ? top + span / 2 : top + (span * node) / (nodeCount - 1);
  return { x, y };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function ease(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function particlePos(p: Particle, local: number): { x: number; y: number; opacity: number; dropped: boolean } {
  const lastLayer = p.fate === 'drop' ? 2 : LAYERS.length - 1;
  const travel = Math.min(1, Math.max(0, local));
  const scaled = travel * lastLayer;
  const i = Math.min(lastLayer - 1, Math.floor(scaled));
  const f = ease(scaled - i);
  const a = nodePoint(i, p.nodes[i], LAYERS[i].nodes);
  const b = nodePoint(i + 1, p.nodes[i + 1], LAYERS[i + 1].nodes);
  const spread = p.fate === 'drop' || travel > 0.9 ? 1.8 : 1;
  const jx = (((p.id * 17) % 21) - 10) * spread;
  const jy = (((p.id * 13) % 19) - 9) * spread;
  let x = lerp(a.x, b.x, f) + jx;
  let y = lerp(a.y, b.y, f) + jy;
  let opacity = p.kind === 'you' ? 1 : 0.88;
  let dropped = false;
  if (p.fate === 'drop' && travel > 0.86) {
    const fall = (travel - 0.86) / 0.14;
    y += fall * 42;
    opacity = Math.max(0.28, 1 - fall * 0.65);
    dropped = fall > 0.2;
  }
  if (travel <= 0) opacity = 0;
  return { x, y, opacity, dropped };
}

type SeatCounts = Partial<Record<TravelClass, number>>;

function otherClasses(won?: string): TravelClass[] {
  const wonClass = won === 'SL' || won === '3A' || won === '2A' ? won : '3A';
  return CLASSES.filter((c) => c !== wonClass);
}

export function TrafficRush({
  journey,
  pnr,
  bookingId,
}: {
  journey?: JourneyTrace | null;
  pnr?: string | null;
  bookingId?: string;
}) {
  const seed = bookingId || pnr || journey?.inventoryId || 'architecture-idle';
  const particles = useMemo(() => buildParticles(seed), [seed]);
  const [run, setRun] = useState(0);
  const [t, setT] = useState(0);
  const [seats, setSeats] = useState<SeatCounts>({});
  const reduce =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const trainRunId = journey?.trainRunId;
    if (!trainRunId) return;
    let cancelled = false;
    void Promise.all(
      CLASSES.map(async (travelClass) => {
        try {
          const row = await getAvailability({ trainRunId, class: travelClass, quota: 'TATKAL' });
          return [travelClass, row.displayedSeats] as const;
        } catch {
          return [travelClass, null] as const;
        }
      }),
    ).then((rows) => {
      if (cancelled) return;
      const next: SeatCounts = {};
      for (const [k, v] of rows) if (v != null) next[k] = v;
      setSeats(next);
    });
    return () => {
      cancelled = true;
    };
  }, [journey?.trainRunId]);

  useEffect(() => {
    if (reduce) {
      setT(1);
      return;
    }
    setT(0);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const next = Math.min(1, (now - start) / DURATION_MS);
      setT(next);
      if (next < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run, reduce]);

  const wonClass = journey?.travelClass === 'SL' || journey?.travelClass === '3A' || journey?.travelClass === '2A'
    ? journey.travelClass
    : undefined;
  const others = otherClasses(wonClass);
  const seatLabels = [
    wonClass ? `${CLASS_LABEL[wonClass]} · yours` : 'This seat · yours',
    others[0] ? `${CLASS_LABEL[others[0]]}` : 'Other class',
    others[1] ? `${CLASS_LABEL[others[1]]}` : 'Other class',
  ];

  const arrived = particles.filter((p) => (t - p.delay) / 0.82 > 0).length;
  const dropped = particles.filter((p) => p.fate === 'drop' && (t - p.delay) / 0.82 > 0.88).length;
  const claimed = t > 0.82 ? 1 : 0;
  const rerouted = particles.filter((p) => p.fate === 'reroute' && (t - p.delay) / 0.82 > 0.92).length;
  const phase =
    t < 0.22 ? 'Everyone arrives' : t < 0.42 ? 'WAF drops bot-like clients' : t < 0.72 ? 'Genuine traffic reaches booking' : t < 0.9 ? 'RDS locks one seat' : 'Losers take another class';

  const lattice = useMemo(() => {
    const lines: { key: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let li = 0; li < LAYERS.length - 1; li += 1) {
      for (let a = 0; a < LAYERS[li].nodes; a += 1) {
        for (let b = 0; b < LAYERS[li + 1].nodes; b += 1) {
          const p = nodePoint(li, a, LAYERS[li].nodes);
          const q = nodePoint(li + 1, b, LAYERS[li + 1].nodes);
          lines.push({ key: `${li}-${a}-${b}`, x1: p.x, y1: p.y, x2: q.x, y2: q.y });
        }
      }
    }
    return lines;
  }, []);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-sky-50/70 to-background p-5 sm:p-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Seat rush</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {BURST} requests hit the same inventory
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            You were one blue request in a Tatkal-shaped mix
            {pnr ? (
              <>
                {' '}
                for PNR <code className="font-mono">{pnr}</code>
              </>
            ) : null}
            . WAF drops bot-like traffic — not an idempotency mismatch. Idempotency only replays the same key.
            After you lock this bucket, other genuine clients get SOLD_OUT here and book another class on the
            same train.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => setRun((n) => n + 1)}>
          Replay
        </Button>
      </header>

      <p className="mb-3 text-sm font-medium text-foreground">{phase}</p>

      <div className="grid gap-2 sm:grid-cols-4">
        <Stat label="In the burst" value={arrived} hint={`${BURST} lab-shaped, not CloudWatch`} />
        <Stat label="Dropped at WAF" value={dropped} hint="bot-like · rate / managed rules" />
        <Stat label="This seat" value={claimed} hint={wonClass ? CLASS_LABEL[wonClass] : 'atomic claim'} />
        <Stat label="Other classes" value={rerouted} hint="SOLD_OUT here · try another bucket" />
      </div>

      <div className="relative mt-5 overflow-hidden rounded-xl bg-[radial-gradient(circle_at_30%_40%,rgba(37,99,235,0.06),transparent_55%)]">
        <svg viewBox="0 0 1000 360" className="h-auto w-full" role="img" aria-label="Traffic flowing through AWS layers">
          {lattice.map((line) => (
            <line
              key={line.key}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="rgb(125 186 230 / 0.28)"
              strokeWidth="0.7"
            />
          ))}
          {LAYERS.map((layer, li) =>
            Array.from({ length: layer.nodes }, (_, ni) => {
              const p = nodePoint(li, ni, layer.nodes);
              const active =
                (li === 2 && t >= 0.28 && t < 0.5) ||
                (li === 5 && t >= 0.68 && t < 0.9) ||
                (li === 6 && t >= 0.86);
              return (
                <circle
                  key={`${layer.id}-${ni}`}
                  cx={p.x}
                  cy={p.y}
                  r={li === 6 ? 7 : 5.5}
                  fill={li === 6 && ni === 0 ? 'rgb(224 242 254)' : 'white'}
                  stroke={active ? 'rgb(37 99 235 / 0.7)' : 'rgb(147 197 253 / 0.85)'}
                  strokeWidth={active ? 1.6 : 1}
                />
              );
            }),
          )}
          {particles.map((p) => {
            const local = Math.min(1, Math.max(0, (t - p.delay) / 0.82));
            const pos = particlePos(p, local);
            const r = p.kind === 'you' ? 5 : 2.7;
            const fill =
              p.kind === 'you'
                ? 'rgb(37 99 235)'
                : p.fate === 'drop' && pos.dropped
                  ? 'rgb(244 163 163)'
                  : p.kind === 'bot'
                    ? 'rgb(148 163 184)'
                    : 'rgb(71 85 105)';
            return (
              <circle
                key={p.id}
                cx={pos.x}
                cy={pos.y}
                r={r}
                fill={fill}
                opacity={pos.opacity}
                style={p.kind === 'you' ? { filter: 'drop-shadow(0 0 6px rgb(37 99 235 / 0.55))' } : undefined}
              />
            );
          })}
        </svg>
        <ol className="grid grid-cols-7 gap-1 px-1 pb-3 text-center text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
          {LAYERS.map((layer, li) => (
            <li key={layer.id}>
              <p className={cn('font-medium', t > li / LAYERS.length && 'text-foreground')}>{layer.label}</p>
              <p className="hidden sm:block">{layer.sub}</p>
            </li>
          ))}
        </ol>
        <ol className="flex justify-end gap-8 pr-6 pb-3 text-[10px] text-muted-foreground sm:text-[11px]">
          {seatLabels.map((label, i) => (
            <li key={label}>
              {label}
              {i > 0 && others[i - 1] && seats[others[i - 1]] != null ? ` · ${seats[others[i - 1]]} left` : null}
              {i === 0 && wonClass && seats[wonClass] != null ? ` · ${seats[wonClass]} left` : null}
            </li>
          ))}
        </ol>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-4 text-xs leading-relaxed text-muted-foreground"
      >
        Burst size is the experiment mix (about 80% legitimate / 20% bot-like), not a live counter for this PNR.
        Same Idempotency-Key retries do not spawn extra claims. Remaining seats above are live advisory counts after
        your booking.
      </motion.p>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
