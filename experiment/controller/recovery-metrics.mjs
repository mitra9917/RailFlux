/**
 * Recovery metrics for failure campaigns (M7 #65) — H6 recovery_time_seconds.
 */
import fs from 'node:fs';
import { aggregateK6Summaries, parseK6SummaryFile } from './k6-summary-metrics.mjs';

export const DEFAULT_SLO_TECHNICAL_ERROR_RATE_MAX = 0.01;
export const DEFAULT_RECOVERY_SUSTAIN_BUCKETS = 3;

function isHttpErrorTags(tags) {
  if (!tags || typeof tags !== 'object') return false;
  if (tags.expected_response === 'false') return true;
  const status = Number(tags.status);
  if (Number.isFinite(status) && status >= 500) return true;
  return false;
}

/**
 * Bucket HTTP request outcomes from k6 --out json= raw.ndjson.
 * @param {string} rawPath
 * @param {number} bucketSeconds
 */
export function bucketHttpOutcomesFromK6Raw(rawPath, bucketSeconds = 5) {
  if (!rawPath || !fs.existsSync(rawPath)) {
    return { buckets: [], bucketSeconds, t0Ms: null };
  }

  /** @type {Map<number, { total: number, errors: number }>} */
  const buckets = new Map();
  let t0Ms = null;

  const text = fs.readFileSync(rawPath, 'utf8');
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row.type !== 'Point' || !row.data?.time) continue;
    const metric = row.metric || row.data?.metric;
    if (metric !== 'http_req_duration' && metric !== 'http_reqs') continue;

    const ts = Date.parse(row.data.time);
    if (!Number.isFinite(ts)) continue;
    if (t0Ms == null) t0Ms = ts;
    const elapsedSec = Math.max(0, (ts - t0Ms) / 1000);
    const bucket = Math.floor(elapsedSec / bucketSeconds);
    const entry = buckets.get(bucket) ?? { total: 0, errors: 0 };
    entry.total += 1;
    if (isHttpErrorTags(row.data.tags)) entry.errors += 1;
    buckets.set(bucket, entry);
  }

  const sorted = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucket, counts]) => ({
      bucket,
      start_seconds: bucket * bucketSeconds,
      total: counts.total,
      errors: counts.errors,
      error_rate: counts.total > 0 ? counts.errors / counts.total : 0,
    }));

  return { buckets: sorted, bucketSeconds, t0Ms };
}

/**
 * @param {object} options
 * @param {number} options.injectionOffsetSeconds
 * @param {number} [options.sloErrorRateMax]
 * @param {number} [options.bucketSeconds]
 * @param {number} [options.sustainBuckets]
 * @param {string[]} [options.rawPaths]
 * @param {object[]} [options.summaries]
 */
export function computeRecoveryFromBuckets(options) {
  const {
    injectionOffsetSeconds,
    sloErrorRateMax = DEFAULT_SLO_TECHNICAL_ERROR_RATE_MAX,
    bucketSeconds = 5,
    sustainBuckets = DEFAULT_RECOVERY_SUSTAIN_BUCKETS,
    rawPaths = [],
  } = options;

  /** @type {{ bucket: number, start_seconds: number, total: number, errors: number, error_rate: number }[]} */
  let buckets = [];
  for (const rawPath of rawPaths) {
    const parsed = bucketHttpOutcomesFromK6Raw(rawPath, bucketSeconds);
    if (parsed.buckets.length) {
      buckets = parsed.buckets;
      break;
    }
  }

  let peakTechnicalErrorRate = 0;
  let preFaultErrorRate = 0;
  let preFaultSamples = 0;

  const injectionBucket = Math.floor(injectionOffsetSeconds / bucketSeconds);

  for (const b of buckets) {
    peakTechnicalErrorRate = Math.max(peakTechnicalErrorRate, b.error_rate);
    if (b.bucket < injectionBucket && b.total > 0) {
      preFaultErrorRate += b.error_rate;
      preFaultSamples += 1;
    }
  }
  if (preFaultSamples > 0) preFaultErrorRate /= preFaultSamples;

  const threshold = Math.max(sloErrorRateMax, preFaultErrorRate * 2);

  let recoveryTimeSeconds = null;
  let sloRestored = false;

  const postFault = buckets.filter((b) => b.start_seconds >= injectionOffsetSeconds);
  for (let i = 0; i <= postFault.length - sustainBuckets; i += 1) {
    const window = postFault.slice(i, i + sustainBuckets);
    if (window.length < sustainBuckets) break;
    const ok = window.every((b) => b.total === 0 || b.error_rate <= threshold);
    if (ok) {
      recoveryTimeSeconds = window[0].start_seconds - injectionOffsetSeconds;
      sloRestored = true;
      break;
    }
  }

  if (recoveryTimeSeconds != null && recoveryTimeSeconds < 0) recoveryTimeSeconds = 0;

  return {
    peak_technical_error_rate: peakTechnicalErrorRate,
    pre_fault_error_rate: preFaultSamples > 0 ? preFaultErrorRate : null,
    recovery_time_seconds: recoveryTimeSeconds,
    slo_restored: sloRestored,
    slo_error_rate_max: sloErrorRateMax,
    threshold_used: threshold,
    bucket_seconds: bucketSeconds,
    buckets_observed: buckets.length,
  };
}

function peakErrorFromSummaries(summaries) {
  let peak = 0;
  for (const summary of summaries) {
    const rate = summary?.metrics?.http_req_failed?.values?.rate;
    if (typeof rate === 'number' && Number.isFinite(rate)) {
      peak = Math.max(peak, rate);
    }
  }
  return peak;
}

/**
 * @param {object} input
 * @param {string} input.failureTestId
 * @param {string} input.failureInjectionType
 * @param {number} input.injectionOffsetSeconds
 * @param {{ index?: { artifacts?: { k6_raw?: string, k6_summary?: string } } }[]} [input.k6Artifacts]
 */
export function buildRecoveryMetrics(input) {
  const rawPaths = [];
  const summaries = [];
  for (const item of input.k6Artifacts || []) {
    const raw = item?.index?.artifacts?.k6_raw;
    const summary = item?.index?.artifacts?.k6_summary;
    if (raw) rawPaths.push(raw);
    if (summary && fs.existsSync(summary)) summaries.push(parseK6SummaryFile(summary));
  }

  const computed = computeRecoveryFromBuckets({
    injectionOffsetSeconds: input.injectionOffsetSeconds,
    rawPaths,
    summaries,
  });

  if (computed.buckets_observed === 0 && summaries.length > 0) {
    computed.peak_technical_error_rate = Math.max(
      computed.peak_technical_error_rate,
      peakErrorFromSummaries(summaries),
    );
    const agg = aggregateK6Summaries(summaries);
    if (agg.demand.offered > 0) {
      computed.pre_fault_error_rate = computed.pre_fault_error_rate ?? 0;
    }
  }

  return {
    failure_test_id: input.failureTestId,
    failure_injection_type: input.failureInjectionType,
    injection_offset_seconds: input.injectionOffsetSeconds,
    recovery_time_seconds: computed.recovery_time_seconds,
    slo_restored: computed.slo_restored,
    peak_technical_error_rate: computed.peak_technical_error_rate,
    pre_fault_error_rate: computed.pre_fault_error_rate,
  };
}
