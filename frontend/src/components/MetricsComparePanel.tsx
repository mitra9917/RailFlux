type PairRow = {
  pair_id: string;
  baseline?: {
    terminal_latency_p99_ms?: number | null;
    terminal_success_rate?: number | null;
    slo_compliant_rps_per_usd?: number | null;
    cache_condition?: string | null;
  } | null;
  optimized?: {
    terminal_latency_p99_ms?: number | null;
    terminal_success_rate?: number | null;
    slo_compliant_rps_per_usd?: number | null;
    cache_condition?: string | null;
  } | null;
};

type DashboardData = {
  campaign_id: string;
  pair_summary?: { valid: number; total: number };
  pairs: PairRow[];
  cost_parity?: { notes?: string };
  analysis?: {
    hypothesis_metrics?: Array<{
      hypothesis_id: string;
      metric?: string;
      geometric_mean_ratio?: number;
      status?: string;
    }>;
  };
};

type MetricDef = {
  title: string;
  unit: string;
  pick: (row: PairRow) => { b: number | null; o: number | null };
  lowerIsBetter?: boolean;
};

const METRICS: MetricDef[] = [
  {
    title: 'Terminal latency p99',
    unit: 'ms',
    pick: (p) => ({
      b: p.baseline?.terminal_latency_p99_ms ?? null,
      o: p.optimized?.terminal_latency_p99_ms ?? null,
    }),
    lowerIsBetter: true,
  },
  {
    title: 'Terminal success rate',
    unit: 'ratio',
    pick: (p) => ({
      b: p.baseline?.terminal_success_rate ?? null,
      o: p.optimized?.terminal_success_rate ?? null,
    }),
  },
  {
    title: 'SLO-compliant offered RPS per USD',
    unit: 'RPS/$',
    pick: (p) => ({
      b: p.baseline?.slo_compliant_rps_per_usd ?? null,
      o: p.optimized?.slo_compliant_rps_per_usd ?? null,
    }),
  },
];

function formatVal(v: number | null, unit: string): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (unit === 'ratio') return `${(v * 100).toFixed(1)}%`;
  return v.toFixed(unit === 'ms' ? 0 : 1);
}

function barWidth(v: number | null, max: number): number {
  if (v == null || !Number.isFinite(v) || max <= 0) return 0;
  return Math.min(100, (v / max) * 100);
}

type Props = { data: DashboardData; dataSourceNote: string };

export function MetricsComparePanel({ data, dataSourceNote }: Props) {
  return (
    <section className="panel compare-metrics">
      <h2>Paired experiment metrics</h2>
      <p className="muted">{dataSourceNote}</p>
      <p className="muted">
        Campaign <code>{data.campaign_id}</code> · valid pairs{' '}
        {data.pair_summary?.valid ?? data.pairs.length}/{data.pair_summary?.total ?? data.pairs.length}
      </p>
      {data.cost_parity?.notes ? <p className="note-inline">{data.cost_parity.notes}</p> : null}

      {METRICS.map((metric) => {
        const rows = data.pairs.map((p) => ({ id: p.pair_id, ...metric.pick(p) }));
        const nums = rows.flatMap((r) => [r.b, r.o]).filter((v): v is number => typeof v === 'number');
        const max = nums.length ? Math.max(...nums, 1) : 1;

        return (
          <div key={metric.title} className="metric-block">
            <h3>{metric.title}</h3>
            <table className="compare-chart">
              <thead>
                <tr>
                  <th>Pair</th>
                  <th>Baseline</th>
                  <th aria-hidden />
                  <th>Optimized</th>
                  <th aria-hidden />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{formatVal(row.b, metric.unit)}</td>
                    <td>
                      <div className="bar baseline" style={{ width: `${barWidth(row.b, max)}%` }} />
                    </td>
                    <td>{formatVal(row.o, metric.unit)}</td>
                    <td>
                      <div className="bar optimized" style={{ width: `${barWidth(row.o, max)}%` }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {data.analysis?.hypothesis_metrics?.length ? (
        <div className="metric-block">
          <h3>Paired analysis (summary)</h3>
          <ul className="analysis-list">
            {data.analysis.hypothesis_metrics.map((m) => (
              <li key={m.hypothesis_id}>
                <strong>{m.hypothesis_id}</strong> {m.metric}:{' '}
                {m.geometric_mean_ratio != null ? `ratio ${m.geometric_mean_ratio.toFixed(2)}` : ''}{' '}
                <span className="muted">{m.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export type { DashboardData };
