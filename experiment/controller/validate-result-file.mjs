#!/usr/bin/env node
/**
 * CLI: validate experiment/runs/*.result.json (M6 #62).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateExperimentResult } from './validate-result-schema.mjs';

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: validate-result-file.mjs PATH.result.json');
    process.exit(1);
  }
  const abs = path.resolve(filePath);
  const result = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const validation = validateExperimentResult(result);
  console.log(
    JSON.stringify({
      event: validation.ok ? 'result_schema_valid' : 'result_schema_invalid',
      path: abs,
      errors: validation.errors,
    }),
  );
  process.exit(validation.ok ? 0 : 1);
}

const isCliMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCliMain) {
  main();
}
