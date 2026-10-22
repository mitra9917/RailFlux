/**
 * Extract demand/latency hints from k6 --summary-export JSON (M6 #60).
 */
import fs from 'node:fs';

function metricCount(metrics, name) {
  const m = metrics?.[name];
  if (!m) return 0;
  if (typeof m.count === 'number') return m.count;
  return 0;
}

function metricPercentile(metrics, name, pct) {
  const m = metrics?.[name];
  if (!m) return 0;
  const key = pct === 50 ? 'med' : `p(${pct})`;
  const v = m[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * @param {string} summaryPath
 */
export function parseK6SummaryFile(summaryPath) {
  const text = fs.readFileSync(summaryPath, 'utf8');
  return JSON.parse(text);
}

/**
 * @param {object} summary k6 summary export
 */
export function aggregateK6Summaries(summaries) {
  let iterations = 0;
  let httpReqs = 0;
  let dropped = 0;
  /** @type {number[]} */
  const p50s = [];
  /** @type {number[]} */
  const p95s = [];
  /** @type {number[]} */
  const p99s = [];

  for (const summary of summaries) {
    const metrics = summary?.metrics ?? {};
    iterations += metricCount(metrics, 'iterations');
    httpReqs += metricCount(metrics, 'http_reqs');
    dropped += metricCount(metrics, 'dropped_iterations');

    const bookingKey = Object.keys(metrics).find((k) =>
      k.startsWith('http_req_duration') && k.includes('op:booking'),
    );
    const durationKey = bookingKey || 'http_req_duration';
    p50s.push(metricPercentile(metrics, durationKey, 50));
    p95s.push(metricPercentile(metrics, durationKey, 95));
    p99s.push(metricPercentile(metrics, durationKey, 99));
  }

  const max = (arr) => (arr.length ? Math.max(...arr) : 0);
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  const offered = iterations + dropped;
  return {
    demand: {
      offered,
      started: iterations,
      completed: httpReqs,
      dropped,
    },
    latencyMs: {
      terminal_p50: avg(p50s),
      terminal_p95: max(p95s),
      terminal_p99: max(p99s),
    },
  };
}

/**
 * @param {{ index?: { artifacts?: { k6_summary?: string, k6_raw?: string } } }[]} k6Artifacts
 */
export function loadMetricsFromK6Artifacts(k6Artifacts) {
  const summaries = [];
  /** @type {string[]} */
  const rawPaths = [];
  /** @type {string[]} */
  const summaryPaths = [];

  for (const item of k6Artifacts || []) {
    const summaryPath = item?.index?.artifacts?.k6_summary;
    const rawPath = item?.index?.artifacts?.k6_raw;
    if (summaryPath && fs.existsSync(summaryPath)) {
      summaries.push(parseK6SummaryFile(summaryPath));
      summaryPaths.push(summaryPath);
    }
    if (rawPath && fs.existsSync(rawPath)) {
      rawPaths.push(rawPath);
    }
  }

  if (summaries.length === 0) {
    return {
      demand: { offered: 0, started: 0, completed: 0, dropped: 0 },
      latencyMs: { terminal_p50: 0, terminal_p95: 0, terminal_p99: 0 },
      artifactPaths: { k6_raw: null, metrics: null },
    };
  }

  const agg = aggregateK6Summaries(summaries);
  return {
    ...agg,
    artifactPaths: {
      k6_raw: rawPaths[0] ?? null,
      metrics: summaryPaths[0] ?? null,
    },
  };
}
