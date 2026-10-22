import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');
const frontend = join(root, 'frontend', 'src');

test('M8 #74 freshness labels cover cache statuses and advisory copy', () => {
  const labels = readFileSync(join(frontend, 'lib/freshness-labels.ts'), 'utf8');
  assert.match(labels, /authoritative for allocation/);
  assert.match(labels, /BYPASS/);
  assert.match(labels, /HIT/);
  assert.match(labels, /MISS/);
});

test('M8 #74 search and availability use FreshnessLabel and AdvisoryBanner', () => {
  const search = readFileSync(join(frontend, 'pages/SearchPage.tsx'), 'utf8');
  const availability = readFileSync(join(frontend, 'pages/AvailabilityPage.tsx'), 'utf8');
  assert.match(search, /AdvisoryBanner/);
  assert.match(search, /FreshnessLabel/);
  assert.match(availability, /AdvisoryBanner/);
  assert.match(availability, /FreshnessLabel/);
  assert.match(availability, /advisory\)/);
});

test('M8 #74 book flow keeps advisory banner', () => {
  const book = readFileSync(join(frontend, 'pages/BookPage.tsx'), 'utf8');
  assert.match(book, /AdvisoryBanner/);
});
