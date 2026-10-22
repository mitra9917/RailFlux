#!/usr/bin/env node
/**
 * Write PT-001 artifact index for experiment export (M6 #56).
 */
import fs from 'node:fs';
import path from 'node:path';

const [runId, summaryPath, rawPath, outPath] = process.argv.slice(2);
if (!runId || !summaryPath || !rawPath || !outPath) {
  console.error(
    'Usage: write-pt001-artifact.mjs RUN_ID SUMMARY.json RAW.ndjson ARTIFACT.json',
  );
  process.exit(1);
}

for (const p of [summaryPath, rawPath]) {
  if (!fs.existsSync(p)) {
    console.error(`Missing file: ${p}`);
    process.exit(1);
  }
}

const payload = {
  test_id: 'PT-001',
  run_id: runId,
  recorded_at: new Date().toISOString(),
  workload: {
    executor: 'constant-arrival-rate',
    rate_rps: Number(process.env.PT001_RATE || 3),
    duration: process.env.PT001_DURATION || '30s',
    base_url: process.env.BASE_URL || 'http://127.0.0.1:3000',
  },
  artifacts: {
    k6_summary: path.resolve(summaryPath),
    k6_raw: path.resolve(rawPath),
  },
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outPath}`);
