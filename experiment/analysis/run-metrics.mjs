/**
 * Run-level metrics for hypothesis tests (M7 #66).
 */
import fs from 'node:fs';
import { PRIMARY_SLO } from '../calibration/calibration-slo.mjs';
import { parseK6SummaryFile } from '../controller/k6-summary-metrics.mjs';
import { arrivalRateForLoadLevel, loadHypothesesCalibration } from '../campaign/read-hypotheses.mjs';

function estimateTechnicalErrorRate(result) {
  const metricsPath = result?.artifacts?.metrics;
  if (metricsPath && fs.existsSync(metricsPath)) {
    const summary = parseK6SummaryFile(metricsPath);
    const m = summary?.metrics?.http_req_failed;
    if (typeof m?.value === 'number') return m.value;
    if (typeof m?.rate === 'number') return m.rate;
    const passes = typeof m?.passes === 'number' ? m.passes : 0;
    const fails = typeof m?.fails === 'number' ? m.fails : 0;
    const total = passes + fails;
    if (total > 0) return passes / total;
  }
  const completed = result?.demand?.completed ?? 0;
  const technical = result?.booking?.technical_failures ?? 0;
  if (completed > 0) return Math.min(1, technical / completed);
  return 0;
}

/**
 * @param {object} result experiment result document
 * @param {typeof PRIMARY_SLO} [limits]
 */
export function evaluateResultSlo(result, limits = PRIMARY_SLO) {
  const droppedRate =
    result.demand.offered > 0 ? result.demand.dropped / result.demand.offered : 0;
  const technicalErrorRate = estimateTechnicalErrorRate(result);
  const terminalP99 = result.latencyMs?.terminal_p99 ?? 0;
  const latencyOk = terminalP99 <= limits.terminal_latency_p99_ms_max;
  const errorOk = technicalErrorRate <= limits.technical_error_rate_max;
  const droppedOk = droppedRate <= limits.dropped_arrival_rate_max;
  const correctnessOk = result.correctness_passed === true;
  const valid = result.valid === true;
  const ok = valid && correctnessOk && latencyOk && errorOk && droppedOk;
  return {
    ok,
    terminal_booking_latency_p99_ms: terminalP99,
    technical_error_rate: technicalErrorRate,
    dropped_arrival_rate: droppedRate,
  };
}

/**
 * @param {object} result
 * @param {{ offered_rps?: number, duration_seconds?: number }} [ctx]
 */
export function sloCompliantOfferedBookingRate(result, ctx = {}) {
  const slo = evaluateResultSlo(result);
  if (!slo.ok) return 0;
  if (typeof ctx.offered_rps === 'number' && ctx.offered_rps > 0) return ctx.offered_rps;
  const duration = ctx.duration_seconds ?? 180;
  if (duration > 0 && result.demand?.offered > 0) {
    return result.demand.offered / duration;
  }
  return 0;
}

/**
 * @param {object} result
 * @param {string} metricId hypothesis metric key
 * @param {object} [ctx]
 */
export function extractMetricValue(result, metricId, ctx = {}) {
  switch (metricId) {
    case 'slo_compliant_offered_booking_rate':
      return sloCompliantOfferedBookingRate(result, ctx);
    case 'terminal_booking_latency_p99_ms':
      return result.latencyMs?.terminal_p99 ?? NaN;
    case 'oversell_count':
      return result.booking?.oversells ?? NaN;
    case 'duplicate_successful_payment_count':
      return result.booking?.duplicate_charges ?? NaN;
    case 'recovery_time_seconds':
      return result.recovery?.recovery_time_seconds ?? NaN;
    case 'legitimate_terminal_success_rate': {
      const bot = result.cohort_mix?.bot_like ?? 0;
      if (bot <= 0) {
        const completed = result.demand?.completed ?? 0;
        const offered = result.demand?.offered ?? 0;
        return offered > 0 ? completed / offered : NaN;
      }
      return NaN;
    }
    default:
      return NaN;
  }
}

/**
 * @param {string} loadLevel
 * @param {string} [hypothesesPath]
 */
export function offeredRpsForLoadLevel(loadLevel, hypothesesPath) {
  try {
    const cal = loadHypothesesCalibration(hypothesesPath);
    return arrivalRateForLoadLevel(loadLevel, cal);
  } catch {
    return NaN;
  }
}
