#!/usr/bin/env node
/**
 * Build experiment/runs/<run_id>.json from controller input state (M6 #58).
 * Writes result.schema.json artifact (M6 #60).
 */
import fs from 'node:fs';
import { buildRunRecord, writeRunRecord } from './export-run-record.mjs';
import { exportExperimentResult } from './export-result.mjs';

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: finalize-run.mjs <input-state.json>');
    process.exit(1);
  }
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const record = buildRunRecord(input);
  const indexPath = writeRunRecord(input.runId, record);

  const exported = await exportExperimentResult(input, { queryDb: true });
  record.experiment_result = {
    path: exported.path,
    schema_valid: exported.validation.ok,
  };
  fs.writeFileSync(indexPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify({
      event: 'experiment_run_complete',
      run_id: input.runId,
      path: indexPath,
      result_path: exported.path,
      result_schema_valid: exported.validation.ok,
      valid: record.valid,
    }),
  );
  process.exit(record.valid ? 0 : 1);
}

main().catch((err) => {
  console.error(JSON.stringify({ event: 'finalize_run_error', message: String(err.message ?? err) }));
  process.exit(1);
});
