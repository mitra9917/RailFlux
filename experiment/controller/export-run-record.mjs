#!/usr/bin/env node
/**
 * Export experiment run index JSON to experiment/runs/ (M6 #58).
 * Full result.schema.json assembly is M6-P4; this links manifest, k6, and correctness.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const RUNS_DIR = path.join(REPO_ROOT, 'experiment/runs');

/**
 * @param {object} input
 */
export function buildRunRecord(input) {
  const {
    runId,
    manifestPath,
    manifest,
    fixtureVerification,
    protocolSteps,
    k6Artifacts = [],
    correctness,
    valid,
    invalidReason = null,
  } = input;

  return {
    schema_version: '1.0',
    record_type: 'experiment_run_index',
    controller_version: '1',
    run_id: runId,
    pair_id: manifest?.pairId || null,
    pair_order: manifest?.pairOrder || null,
    architecture: manifest?.architecture || null,
    manifest_path: manifestPath ? path.resolve(manifestPath) : null,
    fixture: {
      id: manifest?.fixtureId || null,
      sha256_expected: manifest?.fixtureSha256 || null,
      verification: fixtureVerification || null,
    },
    experiment: {
      load_level: manifest?.loadLevel || null,
      inventory_profile: manifest?.inventoryProfile || null,
      cache_condition: manifest?.cacheCondition || null,
      duration_seconds: manifest?.durationSeconds ?? null,
      request_seed: manifest?.requestSeed ?? null,
      cohort_mix: manifest?.cohortMix || null,
    },
    protocol_steps: protocolSteps,
    k6_artifacts: k6Artifacts,
    correctness: correctness || null,
    valid: Boolean(valid),
    invalid_reason: valid ? null : invalidReason,
    exported_at: new Date().toISOString(),
  };
}

export function writeRunRecord(runId, record) {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  const outPath = path.join(RUNS_DIR, `${runId}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return outPath;
}

function readJsonFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    console.error('Usage: export-run-record.mjs <controller-state.json>');
    process.exit(1);
  }
  const state = readJsonFile(configPath);
  if (!state) {
    console.error(`Missing state file: ${configPath}`);
    process.exit(1);
  }
  const record = buildRunRecord(state);
  const outPath = writeRunRecord(state.runId, record);
  console.log(JSON.stringify({ event: 'run_record_exported', path: outPath, valid: record.valid }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
