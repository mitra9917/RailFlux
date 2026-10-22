/**
 * Aggregate measured campaign results for dashboard (M7 #67).
 */
import {
  evaluateResultSlo,
  offeredRpsForLoadLevel,
  sloCompliantOfferedBookingRate,
} from '../analysis/run-metrics.mjs';
import { buildCostParityTable, mergeActualRunCost } from './cost-parity.mjs';

/**
 * @param {object} result
 * @param {object} ctx
 */
function runSnapshot(result, ctx) {
  if (!result) return null;
  const offered = result.demand?.offered ?? 0;
  const completed = result.demand?.completed ?? 0;
  const slo = evaluateResultSlo(result);
  const sloRate = sloCompliantOfferedBookingRate(result, ctx);
  const hourly =
    parseNumeric(result.resources?.actual_run_usd) ??
    parseNumeric(result.resources?.estimated_hourly_usd);
  const efficiency =
    hourly != null && hourly > 0 && sloRate > 0 ? sloRate / hourly : null;

  return {
    run_id: result.run_id,
    valid: result.valid === true,
    cache_condition: result.cache_condition ?? 'none',
    terminal_latency_p99_ms: result.latencyMs?.terminal_p99 ?? null,
    terminal_latency_p95_ms: result.latencyMs?.terminal_p95 ?? null,
    terminal_success_rate: offered > 0 ? completed / offered : null,
    technical_error_rate: slo.technical_error_rate,
    dropped_arrival_rate: slo.dropped_arrival_rate,
    slo_compliant_offered_rps: sloRate,
    queue_p99_ms: result.latencyMs?.queue_p99 ?? null,
    confirmed_bookings: result.booking?.confirmed_unique ?? null,
    hourly_usd: hourly,
    slo_compliant_rps_per_usd: efficiency,
    measured: {
      latency: result.latencyMs?.terminal_p99 != null,
      success: offered > 0,
      cache_hit_ratio: false,
      queue_depth: result.latencyMs?.queue_p99 != null,
      cost_efficiency: efficiency != null,
    },
  };
}

function parseNumeric(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} options
 */
export function buildDashboardData(options) {
  const { campaign, pairRecords, analysisReport = null, hypothesesPath } = options;
  const campaignId = campaign?.plan?.campaign_id ?? 'unknown';

  /** @type {string[]} */
  const unmeasured = [
    'cache_hit_ratio (requires RDS/Redis telemetry export)',
    'queue_depth_age (only queue_p99_ms when present in result)',
    'aws_task_cpu (CloudWatch session export)',
  ];

  /** @type {object[]} */
  const pairRows = [];
  for (const rec of pairRecords) {
    const ctx = {
      offered_rps: offeredRpsForLoadLevel(rec.load_level, hypothesesPath),
      duration_seconds: rec.duration_seconds ?? 180,
    };
    const row = {
      pair_id: rec.pair_id,
      cell_id: rec.cell_id,
      load_level: rec.load_level,
      status: rec.status,
      baseline: rec.baseline_result ? runSnapshot(rec.baseline_result, ctx) : null,
      optimized: rec.optimized_result ? runSnapshot(rec.optimized_result, ctx) : null,
    };
    if (rec.status === 'valid') pairRows.push(row);
  }

  const costParity = buildCostParityTable(campaign);
  if (pairRecords.length) {
    const firstValid = pairRecords.find((r) => r.status === 'valid');
    if (firstValid?.baseline_result) {
      costParity.baseline = mergeActualRunCost(
        costParity.baseline,
        firstValid.baseline_result,
      );
    }
    if (firstValid?.optimized_result) {
      costParity.optimized = mergeActualRunCost(
        costParity.optimized,
        firstValid.optimized_result,
      );
    }
  }

  const hasQueue = pairRows.some(
    (p) => p.baseline?.queue_p99_ms != null || p.optimized?.queue_p99_ms != null,
  );
  if (!hasQueue) {
    unmeasured.push('queue_p99_ms (not present in any valid result)');
  }

  return {
    schema_version: '1.0',
    event: 'results_dashboard_data',
    campaign_id: campaignId,
    pair_summary: {
      total: pairRecords.length,
      valid: pairRecords.filter((r) => r.status === 'valid').length,
      missing_results: pairRecords.filter((r) => r.status === 'missing_results').length,
      invalid_run: pairRecords.filter((r) => r.status === 'invalid_run').length,
    },
    cost_parity: costParity,
    pairs: pairRows,
    analysis: analysisReport
      ? {
          path_hint: analysisReport.path ?? null,
          hypothesis_metrics: (analysisReport.metrics ?? []).map((m) => ({
            hypothesis_id: m.hypothesis_id,
            metric: m.metric,
            geometric_mean_ratio: m.geometric_mean_ratio,
            ci_95_ratio: m.ci_95_ratio,
            n_pairs: m.n_pairs,
            status: m.status ?? 'computed',
          })),
          holm_secondary: analysisReport.holm_secondary ?? [],
        }
      : null,
    unmeasured_claims: unmeasured,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Chart-friendly series (only measured points).
 * @param {ReturnType<typeof buildDashboardData>} data
 */
export function chartSeriesFromDashboard(data) {
  const labels = data.pairs.map((p) => p.pair_id);
  return {
    labels,
    latency_p99_ms: {
      baseline: data.pairs.map((p) => p.baseline?.terminal_latency_p99_ms),
      optimized: data.pairs.map((p) => p.optimized?.terminal_latency_p99_ms),
    },
    terminal_success_rate: {
      baseline: data.pairs.map((p) => p.baseline?.terminal_success_rate),
      optimized: data.pairs.map((p) => p.optimized?.terminal_success_rate),
    },
    cache_condition: data.pairs.map((p) => ({
      pair_id: p.pair_id,
      baseline: p.baseline?.cache_condition,
      optimized: p.optimized?.cache_condition,
    })),
    queue_p99_ms: {
      baseline: data.pairs.map((p) => p.baseline?.queue_p99_ms),
      optimized: data.pairs.map((p) => p.optimized?.queue_p99_ms),
    },
    slo_compliant_rps_per_usd: {
      baseline: data.pairs.map((p) => p.baseline?.slo_compliant_rps_per_usd),
      optimized: data.pairs.map((p) => p.optimized?.slo_compliant_rps_per_usd),
    },
  };
}
