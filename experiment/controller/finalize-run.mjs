#!/usr/bin/env node
/**
 * Build experiment/runs/<run_id>.json from controller input state (M6 #58).
 */
import fs from 'node:fs';
import { buildRunRecord, writeRunRecord } from './export-run-record.mjs';

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: finalize-run.mjs <input-state.json>');
    process.exit(1);
  }
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const record = buildRunRecord(input);
  const outPath = writeRunRecord(input.runId, record);
  console.log(
    JSON.stringify({
      event: 'experiment_run_complete',
      run_id: input.runId,
      path: outPath,
      valid: record.valid,
    }),
  );
  process.exit(record.valid ? 0 : 1);
}

main();
