#!/usr/bin/env node
/**
 * Execute experiment/correctness.sql for a run_id + fixture_id; exit non-zero on violations.
 *
 * Usage: node database/scripts/run-correctness.mjs --run-id <id> [--manifest path]
 * Env: RUN_ID, MYSQL_* , FIXTURE_MANIFEST (see database/scripts/common-env.sh)
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_CORRECTNESS_SQL,
  resolveFixtureId,
  runCorrectnessChecks,
} from './correctness-runner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

function parseArgs(argv) {
  let runId = process.env.RUN_ID?.trim();
  let manifestPath =
    process.env.FIXTURE_MANIFEST?.trim() ||
    path.join(REPO_ROOT, 'experiment/fixtures/manifest.yaml');

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--run-id' && argv[i + 1]) {
      runId = argv[++i];
    } else if (arg === '--manifest' && argv[i + 1]) {
      manifestPath = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node database/scripts/run-correctness.mjs --run-id <id> [--manifest path]
Environment: RUN_ID, MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE`);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }

  if (!runId) {
    console.error('Missing --run-id or RUN_ID');
    process.exit(2);
  }
  return { runId, manifestPath };
}

async function createMysqlPool() {
  const mysql = await import('mysql2/promise');
  return mysql.createPool({
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? '3306'),
    user: process.env.MYSQL_USER ?? 'railflux',
    password: process.env.MYSQL_PASSWORD ?? 'railflux',
    database: process.env.MYSQL_DATABASE ?? 'railflux',
    waitForConnections: true,
    connectionLimit: 2,
  });
}

async function main() {
  const { runId, manifestPath } = parseArgs(process.argv);
  const fixtureId = resolveFixtureId(manifestPath);
  const pool = await createMysqlPool();

  try {
    const result = await runCorrectnessChecks(pool, { runId, fixtureId });
    const payload = {
      event: result.passed ? 'correctness_passed' : 'correctness_failed',
      run_id: result.runId,
      fixture_id: result.fixtureId,
      sql: path.relative(REPO_ROOT, DEFAULT_CORRECTNESS_SQL),
      check_count: result.checkCount,
      failure_count: result.failures.length,
      failures: result.failures.map((f) => ({
        id: f.id,
        description: f.description,
        sample_rows: f.rows.slice(0, 5),
      })),
    };
    console.log(JSON.stringify(payload));

    if (!result.passed) {
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ event: 'correctness_error', message: String(err.message ?? err) }));
  process.exit(1);
});
