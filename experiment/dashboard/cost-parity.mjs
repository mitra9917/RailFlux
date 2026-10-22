/**
 * Resource and cost parity tables (M7 #67 / protocol §Resource and cost parity).
 */

const PLACEHOLDER = /^(TO_SET|TO_BE_GENERATED|none)$/i;

/**
 * @param {unknown} value
 */
export function parseNumericCost(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || PLACEHOLDER.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} manifest run manifest object from campaign plan
 */
export function resourcesFromManifest(manifest) {
  if (!manifest) return null;
  return {
    architecture: manifest.architecture,
    request_serving_vcpu_max_total: manifest.resources?.request_serving_vcpu_max_total ?? null,
    request_serving_memory_gib_max_total:
      manifest.resources?.request_serving_memory_gib_max_total ?? null,
    database_class: manifest.resources?.database_class ?? null,
    cache_class: manifest.resources?.cache_class ?? null,
    estimated_hourly_usd: parseNumericCost(manifest.cost?.estimated_hourly_usd),
    actual_run_usd: null,
  };
}

/**
 * @param {object} result
 */
export function mergeActualRunCost(row, result) {
  if (!row || !result?.resources?.actual_run_usd) return row;
  const actual = parseNumericCost(result.resources.actual_run_usd);
  if (actual == null) return row;
  return { ...row, actual_run_usd: actual };
}

/**
 * @param {object} campaignJson
 */
export function buildCostParityTable(campaignJson) {
  const pairs = campaignJson?.plan?.pairs ?? [];
  /** @type {object | null} */
  let baselineRow = null;
  /** @type {object | null} */
  let optimizedRow = null;

  for (const pair of pairs) {
    for (const manifest of pair.manifests ?? []) {
      if (manifest.architecture === 'baseline' && !baselineRow) {
        baselineRow = resourcesFromManifest(manifest);
      }
      if (manifest.architecture === 'optimized' && !optimizedRow) {
        optimizedRow = resourcesFromManifest(manifest);
      }
    }
  }

  let hourly_delta_pct = null;
  let cost_parity_within_five_pct = null;
  if (
    baselineRow?.estimated_hourly_usd != null &&
    optimizedRow?.estimated_hourly_usd != null
  ) {
    const b = baselineRow.estimated_hourly_usd;
    const o = optimizedRow.estimated_hourly_usd;
    const denom = Math.max(b, o, 1e-9);
    hourly_delta_pct = Number((((o - b) / denom) * 100).toFixed(2));
    cost_parity_within_five_pct = Math.abs(o - b) / denom <= 0.05;
  }

  return {
    protocol: 'resource_and_cost_parity',
    tolerance_hourly_pct: 5,
    baseline: baselineRow,
    optimized: optimizedRow,
    hourly_delta_pct,
    cost_parity_within_five_pct,
    notes:
      baselineRow?.estimated_hourly_usd == null || optimizedRow?.estimated_hourly_usd == null
        ? 'Fill manifest cost.estimated_hourly_usd before claiming cost parity.'
        : null,
  };
}
