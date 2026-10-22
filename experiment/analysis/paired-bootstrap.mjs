/**
 * Paired bootstrap for log(optimized/baseline) ratios (M7 #66 / protocol §Statistics).
 */

/** @param {number[]} values */
export function mean(values) {
  if (!values.length) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** @param {number[]} values */
export function median(values) {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * @param {number} seed
 */
export function createSeededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {number[]} sorted */
function percentileSorted(sorted, p) {
  if (!sorted.length) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * log(optimized / baseline) per matched pair.
 * @param {{ baseline: number, optimized: number }[]} pairs
 */
export function pairedLogRatios(pairs) {
  /** @type {number[]} */
  const logs = [];
  for (const p of pairs) {
    if (!Number.isFinite(p.baseline) || !Number.isFinite(p.optimized)) continue;
    if (p.baseline <= 0 || p.optimized <= 0) continue;
    logs.push(Math.log(p.optimized / p.baseline));
  }
  return logs;
}

/**
 * Paired bootstrap 95% CI on the mean log ratio (protocol: paired bootstrap interval).
 * @param {number[]} logRatios
 * @param {{ iterations?: number, seed?: number, alpha?: number }} [options]
 */
export function pairedBootstrapMeanLogRatio(logRatios, options = {}) {
  const { iterations = 10_000, seed = 66, alpha = 0.05 } = options;
  const n = logRatios.length;
  if (n === 0) {
    return {
      n_pairs: 0,
      log_ratio_mean: null,
      log_ratio_median: null,
      geometric_mean_ratio: null,
      ci_95_log: [null, null],
      ci_95_ratio: [null, null],
    };
  }

  const observedMean = mean(logRatios);
  const observedMedian = median(logRatios);
  const rng = createSeededRng(seed);
  /** @type {number[]} */
  const bootMeans = [];
  for (let b = 0; b < iterations; b += 1) {
    /** @type {number[]} */
    const sample = [];
    for (let i = 0; i < n; i += 1) {
      sample.push(logRatios[Math.floor(rng() * n)]);
    }
    bootMeans.push(mean(sample));
  }
  bootMeans.sort((a, b) => a - b);
  const lo = percentileSorted(bootMeans, alpha / 2);
  const hi = percentileSorted(bootMeans, 1 - alpha / 2);

  return {
    n_pairs: n,
    log_ratio_mean: observedMean,
    log_ratio_median: observedMedian,
    geometric_mean_ratio: Math.exp(observedMean),
    median_ratio: Math.exp(observedMedian),
    ci_95_log: [lo, hi],
    ci_95_ratio: [Math.exp(lo), Math.exp(hi)],
    bootstrap_iterations: iterations,
  };
}

/**
 * One-sided p-value: P(bootstrap mean <= logNull) under paired resampling.
 * @param {number[]} logRatios
 * @param {number} nullRatio e.g. 1.25 for H1 minimum effect
 */
export function pairedBootstrapPValueGreaterThan(logRatios, nullRatio, options = {}) {
  const { iterations = 10_000, seed = 66 } = options;
  const nullLog = Math.log(nullRatio);
  const n = logRatios.length;
  if (n === 0) return { p_value: null, null_ratio: nullRatio };
  const rng = createSeededRng(seed + 1);
  let count = 0;
  for (let b = 0; b < iterations; b += 1) {
    /** @type {number[]} */
    const sample = [];
    for (let i = 0; i < n; i += 1) {
      sample.push(logRatios[Math.floor(rng() * n)]);
    }
    if (mean(sample) <= nullLog) count += 1;
  }
  return { p_value: count / iterations, null_ratio: nullRatio };
}

/**
 * One-sided p-value: P(bootstrap mean >= logNull) — for upper-bound tests (latency ratio).
 */
export function pairedBootstrapPValueLessThan(logRatios, nullRatio, options = {}) {
  const { iterations = 10_000, seed = 66 } = options;
  const nullLog = Math.log(nullRatio);
  const n = logRatios.length;
  if (n === 0) return { p_value: null, null_ratio: nullRatio };
  const rng = createSeededRng(seed + 2);
  let count = 0;
  for (let b = 0; b < iterations; b += 1) {
    /** @type {number[]} */
    const sample = [];
    for (let i = 0; i < n; i += 1) {
      sample.push(logRatios[Math.floor(rng() * n)]);
    }
    if (mean(sample) >= nullLog) count += 1;
  }
  return { p_value: count / iterations, null_ratio: nullRatio };
}
