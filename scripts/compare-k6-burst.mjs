/**
 * Run the same short k6 burst against baseline (:3000) and optimized (:3001).
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signSyntheticJwt } from '@railflux/shared';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'load-tests/k6/compare-burst.js');

export const DEFAULT_DURATION_SEC = 8;
export const DEFAULT_RATE = 12;

function metricBlock(metrics, name) {
  const raw = metrics?.[name];
  if (!raw || typeof raw !== 'object') return null;
  return raw.values && typeof raw.values === 'object' ? raw.values : raw;
}

function num(block, ...keys) {
  if (!block) return null;
  for (const key of keys) {
    const v = block[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

export function summarizeK6Export(summary) {
  const metrics = summary?.metrics ?? {};
  const duration = metricBlock(metrics, 'http_req_duration');
  const reqs = metricBlock(metrics, 'http_reqs');
  const failed = metricBlock(metrics, 'http_req_failed');
  const checks = metricBlock(metrics, 'checks');
  const hits = metricBlock(metrics, 'cache_hits');
  const misses = metricBlock(metrics, 'cache_misses');
  const bypass = metricBlock(metrics, 'cache_bypass');

  const requests = num(reqs, 'count') ?? 0;
  const failedRate = num(failed, 'rate') ?? 0;
  const checkRate = num(checks, 'rate');
  const cacheHitCount = num(hits, 'count') ?? 0;
  const cacheMissCount = num(misses, 'count') ?? 0;
  const cacheBypassCount = num(bypass, 'count') ?? 0;
  const cacheObserved = cacheHitCount + cacheMissCount + cacheBypassCount;

  return {
    requests,
    rps: num(reqs, 'rate') ?? 0,
    p50Ms: num(duration, 'med', 'p(50)') ?? 0,
    p95Ms: num(duration, 'p(95)') ?? 0,
    p99Ms: num(duration, 'p(99)') ?? 0,
    failedRate,
    successRate: checkRate != null ? checkRate : Math.max(0, 1 - failedRate),
    cacheHitCount,
    cacheMissCount,
    cacheBypassCount,
    cacheHitRate: cacheObserved > 0 ? cacheHitCount / cacheObserved : null,
  };
}

function runK6({ baseUrl, token, duration, rate, runId, summaryPath }) {
  return new Promise((resolve, reject) => {
    const args = [
      'run',
      '--quiet',
      '--no-thresholds',
      '--summary-export',
      summaryPath,
      '--env',
      `BASE_URL=${baseUrl}`,
      '--env',
      `K6_BEARER_TOKEN=${token}`,
      '--env',
      `LOAD_DURATION=${duration}`,
      '--env',
      `LOAD_RATE=${String(rate)}`,
      '--env',
      `RUN_ID=${runId}`,
      SCRIPT,
    ];
    const child = spawn('k6', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('k6 timed out after 45s'));
    }, 45000);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err.code === 'ENOENT' ? new Error('k6 is not installed. brew install k6') : err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error((stderr || `k6 exit ${code}`).trim().slice(0, 400)));
        return;
      }
      resolve();
    });
  });
}

async function mintToken() {
  const secret = process.env.SYNTHETIC_JWT_SECRET || 'dev-only-change-me';
  return signSyntheticJwt(secret, {
    userId: '11111111-1111-4111-8111-111111111111',
    cohort: 'k6-compare',
  });
}

export async function checkK6Installed() {
  return new Promise((resolve) => {
    const child = spawn('k6', ['version'], { stdio: ['ignore', 'ignore', 'ignore'] });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

export async function runPairedK6Burst(options = {}) {
  const durationSec = Number(options.durationSec) || DEFAULT_DURATION_SEC;
  const rate = Number(options.rate) || DEFAULT_RATE;
  const duration = `${durationSec}s`;
  const token = options.token || (await mintToken());
  const runId = `live-${Date.now().toString(36)}`;
  const dir = await mkdtemp(path.join(tmpdir(), 'railflux-k6-'));

  try {
    const baselineSummary = path.join(dir, 'baseline.json');
    const optimizedSummary = path.join(dir, 'optimized.json');
    await Promise.all([
      runK6({
        baseUrl: 'http://127.0.0.1:3000',
        token,
        duration,
        rate,
        runId: `${runId}-b`,
        summaryPath: baselineSummary,
      }),
      runK6({
        baseUrl: 'http://127.0.0.1:3001',
        token,
        duration,
        rate,
        runId: `${runId}-o`,
        summaryPath: optimizedSummary,
      }),
    ]);

    const [baselineRaw, optimizedRaw] = await Promise.all([
      readFile(baselineSummary, 'utf8').then((t) => JSON.parse(t)),
      readFile(optimizedSummary, 'utf8').then((t) => JSON.parse(t)),
    ]);

    return {
      ok: true,
      runId,
      mix: '70/20/10 search / availability / book',
      durationSec,
      rate,
      generatedAt: new Date().toISOString(),
      baseline: summarizeK6Export(baselineRaw),
      optimized: summarizeK6Export(optimizedRaw),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const result = await runPairedK6Burst();
  console.log(JSON.stringify(result, null, 2));
}
