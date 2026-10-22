#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const [testId, runId, summaryPath, rawPath, outPath] = process.argv.slice(2);
if (!testId || !runId || !summaryPath || !rawPath || !outPath) {
  console.error(
    'Usage: write-load-artifact.mjs TEST_ID RUN_ID SUMMARY.json RAW.ndjson ARTIFACT.json',
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
  test_id: testId,
  run_id: runId,
  recorded_at: new Date().toISOString(),
  manifest: process.env.LOAD_MANIFEST || null,
  workload: {
    rate_rps: Number(process.env.LOAD_RATE || 0),
    duration: process.env.LOAD_DURATION || null,
    inventory_profile: process.env.LOAD_INVENTORY_PROFILE || null,
    load_level: process.env.LOAD_LEVEL || null,
    base_url: process.env.BASE_URL || null,
  },
  artifacts: {
    k6_summary: path.resolve(summaryPath),
    k6_raw: path.resolve(rawPath),
  },
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outPath}`);
