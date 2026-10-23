import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { summarizeK6Export } from '../scripts/compare-k6-burst.mjs';

const root = join(import.meta.dirname, '..');
const frontend = join(root, 'frontend');

test('Compare page runs live k6 instead of static comparison-data.json', () => {
  const app = readFileSync(join(frontend, 'src/App.tsx'), 'utf8');
  assert.match(app, /path="experiments"/);
  const vite = readFileSync(join(frontend, 'vite.config.ts'), 'utf8');
  assert.match(vite, /compareK6Plugin/);
  const page = readFileSync(join(frontend, 'src/pages/ComparePage.tsx'), 'utf8');
  assert.match(page, /runLiveK6Compare/);
  assert.doesNotMatch(page, /comparison-data\.json/);
  assert.equal(existsSync(join(frontend, 'public/comparison-data.json')), false);
  assert.ok(existsSync(join(root, 'load-tests/k6/compare-burst.js')));
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['compare:k6-burst'], /compare-k6-burst/);
});

test('k6 summary parser reads both flat and values-wrapped exports', () => {
  const parsed = summarizeK6Export({
    metrics: {
      http_req_duration: { values: { med: 40, 'p(95)': 80, 'p(99)': 120 } },
      http_reqs: { values: { count: 96, rate: 12 } },
      http_req_failed: { values: { rate: 0.02 } },
      checks: { values: { rate: 0.97 } },
      cache_hits: { values: { count: 8 } },
      cache_misses: { values: { count: 2 } },
    },
  });
  assert.equal(parsed.p99Ms, 120);
  assert.equal(parsed.requests, 96);
  assert.equal(parsed.successRate, 0.97);
  assert.equal(parsed.cacheHitRate, 0.8);
});
