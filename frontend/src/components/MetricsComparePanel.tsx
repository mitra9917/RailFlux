import { AppCard } from '@/components/app/AppCard';
import type { LiveK6CompareResult, LiveK6Side } from '@/lib/compare-api';

function formatMs(v: number): string {
  return Number.isFinite(v) ? `${Math.round(v)} ms` : '—';
}

function formatPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(1)}%`;
}

function barWidth(v: number | null, max: number): number {
  if (v == null || !Number.isFinite(v) || max <= 0) return 0;
  return Math.min(100, (v / max) * 100);
}

function MetricRow({
  label,
  baseline,
  optimized,
  format,
  lowerIsBetter,
}: {
  label: string;
  baseline: number | null;
  optimized: number | null;
  format: (v: number | null) => string;
  lowerIsBetter?: boolean;
}) {
  const nums = [baseline, optimized].filter((v): v is number => v != null && Number.isFinite(v));
  const max = nums.length ? Math.max(...nums, 0.0001) : 1;
  const optWins =
    baseline != null &&
    optimized != null &&
    (lowerIsBetter ? optimized < baseline : optimized > baseline);

  return (
    <div className="mt-6 first:mt-0">
      <h3 className="text-sm font-semibold">{label}</h3>
      <table className="compare-chart">
        <thead>
          <tr>
            <th>Stack</th>
            <th>Value</th>
            <th aria-hidden />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Baseline</td>
            <td>{format(baseline)}</td>
            <td>
              <div className="bar-baseline" style={{ width: `${barWidth(baseline, max)}%` }} />
            </td>
          </tr>
          <tr>
            <td>{optWins ? 'Optimized (faster/better)' : 'Optimized'}</td>
            <td>{format(optimized)}</td>
            <td>
              <div className="bar-optimized" style={{ width: `${barWidth(optimized, max)}%` }} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function sideLine(side: LiveK6Side): string {
  const cache =
    side.cacheHitRate != null ? ` · cache HIT ${formatPct(side.cacheHitRate)}` : '';
  return `${side.requests} req · ${side.rps.toFixed(1)} rps · p50 ${Math.round(side.p50Ms)} ms${cache}`;
}

type Props = {
  data: LiveK6CompareResult;
};

export function MetricsComparePanel({ data }: Props) {
  return (
    <AppCard
      title="Live k6 compare"
      subtitle={`${data.mix} · ${data.durationSec}s · ${data.rate} req/s each stack · ${data.runId}`}
    >
      <p className="text-sm text-muted-foreground">{sideLine(data.baseline)}</p>
      <p className="mt-1 text-sm text-muted-foreground">{sideLine(data.optimized)}</p>

      <MetricRow
        label="Terminal latency p99"
        baseline={data.baseline.p99Ms}
        optimized={data.optimized.p99Ms}
        format={(v) => (v == null ? '—' : formatMs(v))}
        lowerIsBetter
      />
      <MetricRow
        label="Terminal latency p95"
        baseline={data.baseline.p95Ms}
        optimized={data.optimized.p95Ms}
        format={(v) => (v == null ? '—' : formatMs(v))}
        lowerIsBetter
      />
      <MetricRow
        label="Check success rate"
        baseline={data.baseline.successRate}
        optimized={data.optimized.successRate}
        format={formatPct}
      />
      <MetricRow
        label="Availability cache HIT rate"
        baseline={data.baseline.cacheHitRate}
        optimized={data.optimized.cacheHitRate}
        format={formatPct}
      />
    </AppCard>
  );
}
