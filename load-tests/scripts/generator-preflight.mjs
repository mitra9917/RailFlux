#!/usr/bin/env node
/**
 * Load generator preflight gates (M6 #61) — protocol: CPU <70%, network OK, start delay bounds.
 */
import fs from 'node:fs';
import os from 'os';
import { pathToFileURL } from 'node:url';
import { parseK6SummaryFile } from '../../experiment/controller/k6-summary-metrics.mjs';

export const DEFAULT_LIMITS = {
  maxHostLoadPct: 70,
  maxDroppedRate: 0.001,
  maxBlockedP95Ms: 750,
  maxStartDelayMs: 2000,
  networkTimeoutMs: 5000,
};

/**
 * Host load proxy: 1-min load average as % of CPU capacity (protocol CPU gate before k6).
 */
export function sampleHostLoadPct() {
  const cpus = os.cpus().length || 1;
  const [load1] = os.loadavg();
  const loadPct = (load1 / cpus) * 100;
  return {
    cpus,
    load1,
    loadPct: Number(loadPct.toFixed(2)),
  };
}

/**
 * @param {object} sample
 * @param {typeof DEFAULT_LIMITS} [limits]
 */
export function evaluateHostPreflight(sample, limits = DEFAULT_LIMITS) {
  const ok = sample.loadPct < limits.maxHostLoadPct;
  return {
    gate: 'host_cpu_load',
    ok,
    load_pct: sample.loadPct,
    cpus: sample.cpus,
    limit_pct: limits.maxHostLoadPct,
    reason: ok ? null : 'host_load_at_or_above_70pct',
  };
}

/**
 * @param {string} baseUrl
 * @param {typeof DEFAULT_LIMITS} [limits]
 */
export async function probeNetwork(baseUrl, limits = DEFAULT_LIMITS) {
  const url = `${baseUrl.replace(/\/$/, '')}/health/live`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(limits.networkTimeoutMs),
    });
    const elapsedMs = Date.now() - started;
    const ok = res.ok && elapsedMs < limits.networkTimeoutMs;
    return {
      gate: 'network_probe',
      ok,
      url,
      status: res.status,
      elapsed_ms: elapsedMs,
      reason: ok ? null : 'network_probe_failed_or_slow',
    };
  } catch (err) {
    return {
      gate: 'network_probe',
      ok: false,
      url,
      elapsed_ms: Date.now() - started,
      reason: err instanceof Error ? err.message : 'network_probe_error',
    };
  }
}

function metricValue(metrics, name, field) {
  const m = metrics?.[name];
  if (!m) return 0;
  const v = m[field];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * Post-run k6 saturation / start-delay gates (generator-limited runs are invalid).
 * @param {object} summary
 * @param {typeof DEFAULT_LIMITS} [limits]
 */
export function evaluateK6GeneratorPreflight(summary, limits = DEFAULT_LIMITS) {
  const metrics = summary?.metrics ?? {};
  const iterations = metricValue(metrics, 'iterations', 'count');
  const dropped = metricValue(metrics, 'dropped_iterations', 'count');
  const offered = iterations + dropped;
  const droppedRate = offered > 0 ? dropped / offered : 0;

  const blockedP95 = metricValue(metrics, 'http_req_blocked', 'p(95)');
  const iterMed = metricValue(metrics, 'iteration_duration', 'med');
  const iterMax = metricValue(metrics, 'iteration_duration', 'max');
  const startDelayMs = iterMed > 0 ? iterMax - iterMed : iterMax;

  const droppedOk = droppedRate <= limits.maxDroppedRate;
  const blockedOk = blockedP95 <= limits.maxBlockedP95Ms;
  const startOk = startDelayMs <= limits.maxStartDelayMs;

  const ok = droppedOk && blockedOk && startOk;
  /** @type {string[]} */
  const reasons = [];
  if (!droppedOk) reasons.push('dropped_iterations_above_limit');
  if (!blockedOk) reasons.push('http_req_blocked_p95_high');
  if (!startOk) reasons.push('scheduled_start_delay_high');

  return {
    gate: 'k6_generator',
    ok,
    iterations,
    dropped,
    dropped_rate: Number(droppedRate.toFixed(6)),
    dropped_rate_limit: limits.maxDroppedRate,
    http_req_blocked_p95_ms: blockedP95,
    start_delay_ms: Number(startDelayMs.toFixed(2)),
    reasons: reasons.length ? reasons : null,
  };
}

/**
 * @param {object[]} checks
 */
export function aggregatePreflightChecks(checks) {
  const list = checks.filter(Boolean);
  const ok = list.every((c) => c.ok);
  return {
    event: ok ? 'generator_preflight_passed' : 'generator_preflight_failed',
    ok,
    checks: list,
    generator_cpu_max_pct: list.find((c) => c.gate === 'host_cpu_load')?.load_pct ?? null,
  };
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(`Usage:
  generator-preflight.mjs host [--base-url URL]
  generator-preflight.mjs k6-summary PATH
  generator-preflight.mjs full --base-url URL --k6-summary PATH`);
    process.exit(cmd ? 0 : 1);
  }

  if (cmd === 'host') {
    let baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';
    for (let i = 0; i < rest.length; i += 1) {
      if (rest[i] === '--base-url' && rest[i + 1]) baseUrl = rest[++i];
    }
    const host = evaluateHostPreflight(sampleHostLoadPct());
    const network = await probeNetwork(baseUrl);
    const result = aggregatePreflightChecks([host, network]);
    console.log(JSON.stringify(result));
    process.exit(result.ok ? 0 : 1);
  }

  if (cmd === 'k6-summary') {
    const path = rest[0];
    if (!path || !fs.existsSync(path)) {
      console.error('Missing or invalid k6 summary path');
      process.exit(2);
    }
    const summary = parseK6SummaryFile(path);
    const k6 = evaluateK6GeneratorPreflight(summary);
    const result = aggregatePreflightChecks([k6]);
    console.log(JSON.stringify(result));
    process.exit(result.ok ? 0 : 1);
  }

  if (cmd === 'full') {
    let baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';
    let summaryPath = '';
    for (let i = 0; i < rest.length; i += 1) {
      if (rest[i] === '--base-url' && rest[i + 1]) baseUrl = rest[++i];
      else if (rest[i] === '--k6-summary' && rest[i + 1]) summaryPath = rest[++i];
    }
    const host = evaluateHostPreflight(sampleHostLoadPct());
    const network = await probeNetwork(baseUrl);
    /** @type {object[]} */
    const checks = [host, network];
    if (summaryPath && fs.existsSync(summaryPath)) {
      checks.push(evaluateK6GeneratorPreflight(parseK6SummaryFile(summaryPath)));
    }
    const result = aggregatePreflightChecks(checks);
    console.log(JSON.stringify(result));
    process.exit(result.ok ? 0 : 1);
  }

  console.error(`Unknown command: ${cmd}`);
  process.exit(2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(JSON.stringify({ event: 'generator_preflight_error', message: String(err.message ?? err) }));
    process.exit(1);
  });
}
