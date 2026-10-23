import { Link } from 'react-router-dom';
import { PageShell } from '@/components/app/PageShell';
import {
  AlbMark,
  CloudFrontMark,
  EcsMark,
  ElastiCacheMark,
  RdsMark,
  S3Mark,
  SqsMark,
  WafMark,
} from '@/components/site/AwsMarks';
import type { ComponentType } from 'react';

type Service = {
  name: string;
  role: string;
  onSite: string;
  Mark: ComponentType<{ className?: string }>;
};

const SERVICES: Service[] = [
  {
    name: 'Amazon CloudFront',
    role: 'TLS and cache at the edge. The only public entry — ALB is origin-locked; S3 is never public.',
    onSite: 'Every page you are on now.',
    Mark: CloudFrontMark,
  },
  {
    name: 'Amazon S3',
    role: 'Static build only. Never a public bucket — CloudFront reads it through origin access control.',
    onSite: 'HTML, CSS, this UI.',
    Mark: S3Mark,
  },
  {
    name: 'AWS WAF',
    role: 'Optional web ACL on CloudFront. On only when an experiment cell studies bots — we measure false positives.',
    onSite: 'Experiments cells, not the happy path.',
    Mark: WafMark,
  },
  {
    name: 'Application Load Balancer',
    role: 'HTTPS offload. Baseline: one target. Optimized: /search and /availability → read; /bookings → booking.',
    onSite: 'Search vs Book take different fleets.',
    Mark: AlbMark,
  },
  {
    name: 'Amazon ECS on Fargate',
    role: 'Baseline is one monolith task. Optimized splits read, booking, and worker so enquiry cannot starve claims.',
    onSite: 'APIs behind Search, Availability, and Pay.',
    Mark: EcsMark,
  },
  {
    name: 'Amazon ElastiCache (Redis)',
    role: 'Cache-aside for advisory search and availability. TTL is short. Booking never reads this.',
    onSite: 'HIT / MISS / BYPASS on Availability and Experiments.',
    Mark: ElastiCacheMark,
  },
  {
    name: 'Amazon RDS for MySQL',
    role: 'Primary is the only place a seat is claimed. Replica serves cache misses. Lag is never trusted to book.',
    onSite: 'Inventory claim and the PNR you see after pay.',
    Mark: RdsMark,
  },
  {
    name: 'Amazon SQS + DLQ',
    role: 'Notify / audit after commit. Response returns CONFIRMED first. Worker is at-least-once; poison goes to the DLQ.',
    onSite: 'After booking status — not on the request timer.',
    Mark: SqsMark,
  },
];

const TATKAL = [
  {
    problem: '10:00 / 11:00 open is a synchronized herd. Enquiry volume dwarfs tickets (public NGeT figures).',
    ours: 'k6 replays that mix on two stacks we own. Read ECS absorbs enquiry; booking ECS only claims.',
  },
  {
    problem: 'Shown Tatkal seats vanish. Public IRCTC does not publish cache or lock internals.',
    ours: 'Availability is labeled advisory. Freshness is HIT, MISS, or BYPASS — the UI does not pretend a cache is inventory.',
  },
  {
    problem: 'PIB (2025): bots can be ~50% of early Tatkal logins. Controls listed: CDN, WAF, CAPTCHA — not a disclosed data plane.',
    ours: 'WAF is a measured cell, not theatre. We compare our monolith to our split design — not to unpublished IRCTC code.',
  },
  {
    problem: 'A conventional rush design does notify/audit on the request thread. Under load, that delays or drops CONFIRMED.',
    ours: 'Atomic claim on RDS primary, then SQS. You get a PNR even if the worker is behind.',
  },
];

export function AboutPage() {
  return (
    <PageShell
      wide
      eyebrow="RailFlux"
      title="A Tatkal lab, not a clone."
      lead="Same fixture, two AWS stacks. We beat our Tatkal-shaped monolith — not unpublished IRCTC internals."
    >
      <p className="max-w-xl text-sm text-muted-foreground">
        <Link to="/architecture" className="text-foreground underline-offset-4 hover:underline">
          Architecture
        </Link>{' '}
        is the path.{' '}
        <Link to="/experiments" className="text-foreground underline-offset-4 hover:underline">
          Experiments
        </Link>{' '}
        is live k6 on both.
      </p>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">AWS on this site</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Console-colored marks. Each row is a service we actually wire — and where you feel it.
        </p>
        <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
          {SERVICES.map(({ name, role, onSite, Mark }) => (
            <li key={name} className="grid gap-3 px-4 py-4 sm:grid-cols-[auto_1fr_12rem] sm:items-start sm:gap-5 sm:px-5">
              <Mark className="size-8 shadow-sm" />
              <div>
                <p className="text-sm font-medium tracking-tight">{name}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{role}</p>
              </div>
              <p className="text-[13px] leading-snug text-muted-foreground sm:text-right">{onSite}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold tracking-tight">Better than Tatkal’s failure mode</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          IRCTC’s production stack is unpublished. Public facts (Tatkal clock, enquiry-heavy NGeT, CDN/WAF,
          bot share) define the <em>event</em>. RailFlux is better than a Tatkal-shaped monolith — our
          baseline — not a claim that we outrun IRCTC.
        </p>
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {TATKAL.map((row) => (
            <li key={row.ours} className="rounded-2xl border border-border bg-card p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Tatkal / public
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{row.problem}</p>
              <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-foreground">
                RailFlux optimized
              </p>
              <p className="mt-2 text-sm leading-relaxed">{row.ours}</p>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
