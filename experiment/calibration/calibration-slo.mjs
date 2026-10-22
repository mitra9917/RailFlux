/**
 * PT-002 calibration SLO gates (M7 #63) — primary endpoint from hypotheses.yaml.
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseK6SummaryFile } from '../controller/k6-summary-metrics.mjs';
import { evaluateK6GeneratorPreflight } from '../../load-tests/scripts/generator-preflight.mjs';

/** @type {import('../../load-tests/scripts/generator-preflight.mjs').DEFAULT_LIMITS} */
export const PRIMARY_SLO = {
  terminal_latency_p99_ms_max: 2000,
  technical_error_rate_max: 0.01,
  dropped_arrival_rate_max: 0.001,
};

function metricRate(metrics, name) {
  const m = metrics?.[name];
  if (!m) return 0;
  if (typeof m.value === 'number' && Number.isFinite(m.value)) return m.value;
  if (typeof m.rate === 'number' && Number.isFinite(m.rate)) return m.rate;
  const passes = typeof m.passes === 'number' ? m.passes : 0;
  const fails = typeof m.fails === 'number' ? m.fails : 0;
  const total = passes + fails;
  // k6 rate metrics: `passes` = failed requests for http_req_failed
  if (name === 'http_req_failed' && total > 0) return passes / total;
  return total > 0 ? fails / total : 0;
}

function metricCount(metrics, name) {
  const m = metrics?.[name];
  if (!m) return 0;
  return typeof m.count === 'number' ? m.count : 0;
}

function bookingP99Ms(metrics) {
  const bookingKey = Object.keys(metrics).find(
    (k) => k.startsWith('http_req_duration') && k.includes('op:booking'),
  );
  const key = bookingKey || 'http_req_duration';
  const m = metrics[key];
  const p99 = m?.['p(99)'];
  return typeof p99 === 'number' && Number.isFinite(p99) ? p99 : 0;
}

/**
 * @param {object} summary k6 --summary-export JSON
 * @param {typeof PRIMARY_SLO} [limits]
 */
export function evaluateCalibrationStep(summary, limits = PRIMARY_SLO) {
  const metrics = summary?.metrics ?? {};
  const iterations = metricCount(metrics, 'iterations');
  const dropped = metricCount(metrics, 'dropped_iterations');
  const offered = iterations + dropped;
  const droppedRate = offered > 0 ? dropped / offered : 0;
  const technicalErrorRate = metricRate(metrics, 'http_req_failed');
  const terminalP99 = bookingP99Ms(metrics);
  const generator = evaluateK6GeneratorPreflight(summary);

  const latencyOk = terminalP99 <= limits.terminal_latency_p99_ms_max;
  const errorOk = technicalErrorRate <= limits.technical_error_rate_max;
  const droppedOk = droppedRate <= limits.dropped_arrival_rate_max;
  const generatorOk = generator.ok;

  /** @type {string[]} */
  const reasons = [];
  if (!latencyOk) reasons.push('terminal_booking_p99_above_limit');
  if (!errorOk) reasons.push('technical_error_rate_above_limit');
  if (!droppedOk) reasons.push('dropped_arrival_rate_above_limit');
  if (!generatorOk && generator.reasons) reasons.push(...generator.reasons);

  const ok = latencyOk && errorOk && droppedOk && generatorOk;

  return {
    gate: 'calibration_slo',
    ok,
    terminal_booking_latency_p99_ms: Number(terminalP99.toFixed(2)),
    technical_error_rate: Number(technicalErrorRate.toFixed(6)),
    dropped_arrival_rate: Number(droppedRate.toFixed(6)),
    offered_iterations: offered,
    generator,
    reasons: reasons.length ? reasons : null,
  };
}

/**
 * @param {{ rate_rps: number, slo: ReturnType<typeof evaluateCalibrationStep> }[]} steps
 */
export function deriveSloCapacityFromSteps(steps) {
  let capacity = 0;
  let firstFailing = null;
  for (const step of steps) {
    if (step.slo.ok) capacity = step.rate_rps;
    else if (firstFailing === null) firstFailing = step.rate_rps;
  }
  return { slo_capacity_offered_rps: capacity, first_failing_rate_rps: firstFailing };
}

/**
 * @param {number} capacityRps
 */
export function progressiveLoadRates(capacityRps) {
  const round = (n) => Number(n.toFixed(2));
  return {
    pct_50: round(capacityRps * 0.5),
    pct_80: round(capacityRps * 0.8),
    pct_110: round(capacityRps * 1.1),
  };
}

async function main() {
  const [cmd, summaryPath] = process.argv.slice(2);
  if (cmd === 'evaluate') {
    if (!summaryPath || !fs.existsSync(summaryPath)) {
      console.error('Usage: calibration-slo.mjs evaluate PATH/to/summary.json');
      process.exit(2);
    }
    const summary = parseK6SummaryFile(summaryPath);
    const result = evaluateCalibrationStep(summary);
    console.log(JSON.stringify({ event: 'calibration_step_evaluated', ...result }));
    process.exit(result.ok ? 0 : 1);
  }
  console.error('Usage: calibration-slo.mjs evaluate PATH');
  process.exit(2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(JSON.stringify({ event: 'calibration_slo_error', message: String(err.message ?? err) }));
    process.exit(1);
  });
}
