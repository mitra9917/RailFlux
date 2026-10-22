import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { generatePairManifests } from '../experiment/controller/generate-run-manifest.mjs';

const root = join(import.meta.dirname, '..');

test('M6 #62 gate script runs ci and experiment unit bundle', () => {
  const gate = readFileSync(join(root, 'scripts/m6-gate.sh'), 'utf8');
  assert.match(gate, /npm run ci/);
  assert.match(gate, /test:m6-gate/);
  assert.match(gate, /experiment:generate-manifest/);
  assert.match(gate, /load:pt001/);
  assert.match(gate, /experiment:run/);
  assert.match(gate, /validate-result-file/);
});

test('M6 #62 gate manifest generator produces AB pair for seed 772910', () => {
  const manifests = generatePairManifests({
    pairId: 'm6-gate-pair',
    randomizationSeed: 772910,
    sessionName: 'm6-gate-local',
  });
  assert.equal(manifests.length, 2);
  assert.equal(manifests[0].pair_order, 'AB');
  assert.equal(manifests[0].architecture, 'baseline');
  assert.equal(manifests[1].architecture, 'optimized');
});

test('M6 #62 package exposes gate:m6', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['gate:m6'], /m6-gate\.sh/);
  assert.match(pkg.scripts['test:m6-gate'], /m6-gate\.test\.mjs/);
});
