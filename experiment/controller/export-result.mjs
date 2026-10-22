#!/usr/bin/env node
/**
 * Build experiment/result.schema.json document from controller state (M6 #60).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMetricsFromK6Artifacts } from './k6-summary-metrics.mjs';
import { createMysqlPoolFromEnv, queryBookingStats } from './query-booking-stats.mjs';
import { validateExperimentResult } from './validate-result-schema.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const RUNS_DIR = path.join(REPO_ROOT, 'experiment/runs');

const LOAD_LEVELS = new Set(['smoke', 'L50', 'L80', 'L110', 'soak', 'failure']);

function normalizeLoadLevel(level) {
  if (!level) return undefined;
  const s = String(level);
  if (LOAD_LEVELS.has(s)) return s;
  if (/^L\d+$/.test(s)) return 'smoke';
  return undefined;
}

function correctnessPassed(correctness) {
  if (!correctness) return false;
  if (correctness.event === 'correctness_passed') return true;
  if (correctness.event === 'correctness_failed') return false;
  if (typeof correctness.passed === 'boolean') return correctness.passed;
  return false;
}

/**
 * @param {object} input controller finalize state
 * @param {object} [options]
 */
export function buildExperimentResult(input, options = {}) {
  const { bookingStats = null, k6Metrics = null } = options;
  const manifest = input.manifest || {};
  const fixtureSha =
    input.fixtureVerification?.fixture_sha256 ||
    manifest.fixtureSha256 ||
    'unknown';

  const metrics =
    k6Metrics ??
    loadMetricsFromK6Artifacts(input.k6Artifacts || []);

  const booking = bookingStats ?? {
    confirmed_unique: 0,
    sold_out: 0,
    technical_failures: 0,
    timeouts_unknown: 0,
    oversells: 0,
    duplicate_charges: 0,
  };

  const corrPassed = correctnessPassed(input.correctness);
  const preflightOk = input.generatorPreflight?.ok !== false;
  const valid = Boolean(input.valid) && corrPassed && preflightOk;

  /** @type {Record<string, unknown>} */
  const result = {
    schema_version: '1.0',
    run_id: input.runId,
    pair_id: manifest.pairId || input.runId,
    architecture: manifest.architecture === 'optimized' ? 'optimized' : 'baseline',
    fixture_sha256: fixtureSha,
    request_seed: Number(manifest.requestSeed ?? 0),
    demand: metrics.demand,
    booking,
    latencyMs: metrics.latencyMs,
    correctness_passed: corrPassed,
    valid,
    invalid_reason: valid
      ? null
      : !preflightOk
        ? 'generator_preflight_failed'
        : input.invalidReason || 'run_invalid',
    generator_cpu_max_pct:
      input.generatorPreflight?.generator_cpu_max_pct ?? undefined,
    artifacts: {
      k6_raw: metrics.artifactPaths?.k6_raw || undefined,
      metrics: metrics.artifactPaths?.metrics || undefined,
      reconciliation: input.correctness ? path.join(RUNS_DIR, `${input.runId}.json`) : undefined,
    },
  };

  if (manifest.pairOrder === 'AB' || manifest.pairOrder === 'BA') {
    result.pair_order = manifest.pairOrder;
  }
  if (manifest.cacheCondition && ['none', 'cold', 'warm'].includes(manifest.cacheCondition)) {
    result.cache_condition = manifest.cacheCondition;
  }
  const loadLevel = normalizeLoadLevel(manifest.loadLevel);
  if (loadLevel) result.load_level = loadLevel;
  if (manifest.cohortMix) {
    result.cohort_mix = {
      legitimate: Number(manifest.cohortMix.legitimate ?? 1),
      bot_like: Number(manifest.cohortMix.bot_like ?? 0),
    };
  }

  return result;
}

export function writeExperimentResult(runId, result) {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  const outPath = path.join(RUNS_DIR, `${runId}.result.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return outPath;
}

/**
 * @param {object} input
 * @param {{ queryDb?: boolean }} [options]
 */
export async function exportExperimentResult(input, options = {}) {
  const queryDb = options.queryDb !== false;
  let bookingStats = null;
  let pool;

  if (queryDb && input.runId) {
    try {
      pool = await createMysqlPoolFromEnv();
      bookingStats = await queryBookingStats(pool, input.runId);
    } catch {
      bookingStats = null;
    } finally {
      if (pool) await pool.end();
    }
  }

  const result = buildExperimentResult(input, { bookingStats });
  const pathWritten = writeExperimentResult(input.runId, result);
  const validation = validateExperimentResult(result);

  return { result, path: pathWritten, validation };
}

function loadInputFromRunIndex(indexPath) {
  const record = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  if (record.record_type === 'experiment_run_index') {
    return {
      runId: record.run_id,
      manifestPath: record.manifest_path,
      manifest: {
        pairId: record.pair_id,
        pairOrder: record.pair_order,
        architecture: record.architecture,
        loadLevel: record.experiment?.load_level,
        cacheCondition: record.experiment?.cache_condition,
        requestSeed: record.experiment?.request_seed,
        cohortMix: record.experiment?.cohort_mix,
      },
      fixtureVerification: record.fixture?.verification,
      k6Artifacts: record.k6_artifacts,
      correctness: record.correctness,
      valid: record.valid,
      invalidReason: record.invalid_reason,
    };
  }
  return record;
}

async function main() {
  const args = process.argv.slice(2);
  const fromIndex = args[0] === '--from-run-index' ? args[1] : null;
  const inputPath = fromIndex || args[0];
  const skipDb = args.includes('--skip-db');

  if (!inputPath) {
    console.error(`Usage: export-result.mjs [--from-run-index] <state-or-index.json> [--skip-db]`);
    process.exit(1);
  }

  const input = loadInputFromRunIndex(inputPath);
  const exported = await exportExperimentResult(input, { queryDb: !skipDb });
  console.log(
    JSON.stringify({
      event: 'experiment_result_exported',
      path: exported.path,
      schema_valid: exported.validation.ok,
      errors: exported.validation.ok ? [] : exported.validation.errors,
    }),
  );
  process.exit(exported.validation.ok ? 0 : 1);
}

const isCliMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCliMain) {
  main().catch((err) => {
    console.error(JSON.stringify({ event: 'export_result_error', message: String(err.message ?? err) }));
    process.exit(1);
  });
}
