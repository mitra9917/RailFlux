import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  arrivalRateForLoadLevel,
  parseHypothesesCalibration,
} from '../experiment/campaign/read-hypotheses.mjs';
import {
  DEFAULT_REPETITIONS,
  PRINCIPAL_CELLS,
  selectPrincipalCells,
} from '../experiment/campaign/principal-cells.mjs';
import {
  buildCampaignPlan,
  DEFAULT_PRINCIPAL_DURATION_SECONDS,
  SMOKE_DURATION_SECONDS,
} from '../experiment/campaign/run-principal-campaign.mjs';
import {
  generatePairManifests,
} from '../experiment/controller/generate-run-manifest.mjs';
import { loadLevelToArrivalRate } from '../load-tests/scripts/load-manifest.mjs';

const root = join(import.meta.dirname, '..');

test('M7 #64 four principal cells defined', () => {
  assert.equal(PRINCIPAL_CELLS.length, 4);
  assert.ok(PRINCIPAL_CELLS.every((c) => c.inventoryProfile === 'contention'));
});

test('M7 #64 campaign plan default 20 pairs and 40 runs', () => {
  const plan = buildCampaignPlan({ campaignId: 'test', repetitions: DEFAULT_REPETITIONS });
  assert.equal(plan.pair_count, 20);
  assert.equal(plan.run_count, 40);
  assert.equal(plan.pairs[0].manifests.length, 2);
});

test('M7 #64 max-pairs budget reduction', () => {
  const plan = buildCampaignPlan({ campaignId: 'test', repetitions: 5, maxPairs: 2 });
  assert.equal(plan.pair_count, 2);
});

test('M7 #64 smoke duration on manifests', () => {
  const plan = buildCampaignPlan({
    campaignId: 'test',
    repetitions: 1,
    maxPairs: 1,
    cellIds: ['C1-L80-legit'],
    durationSeconds: SMOKE_DURATION_SECONDS,
  });
  assert.equal(plan.duration_seconds, SMOKE_DURATION_SECONDS);
  assert.equal(
    plan.pairs[0].manifests[0].experiment.duration_seconds,
    SMOKE_DURATION_SECONDS,
  );
  assert.equal(DEFAULT_PRINCIPAL_DURATION_SECONDS, 180);
});

test('M7 #64 frozen hypotheses map L80/L110 to calibrated RPS', () => {
  const hyp = readFileSync(join(root, 'experiment/hypotheses.yaml'), 'utf8');
  const cal = parseHypothesesCalibration(hyp);
  assert.equal(arrivalRateForLoadLevel('L80', cal), 32);
  assert.equal(arrivalRateForLoadLevel('L110', cal), 44);
  assert.equal(loadLevelToArrivalRate('L80', 8, cal), 32);
});

test('M7 #64 cache condition per architecture in pair manifests', () => {
  const cell = selectPrincipalCells(PRINCIPAL_CELLS, ['C1-L80-legit'])[0];
  const manifests = generatePairManifests({
    pairId: 'pair-cache',
    randomizationSeed: 2,
    sessionName: 'lab',
    wafMode: cell.wafMode,
    loadLevel: cell.loadLevel,
    inventoryProfile: cell.inventoryProfile,
    cohortMix: cell.cohortMix,
    cacheConditionByArchitecture: cell.cacheConditionByArchitecture,
  });
  const baseline = manifests.find((m) => m.architecture === 'baseline');
  const optimized = manifests.find((m) => m.architecture === 'optimized');
  assert.equal(baseline.experiment.cache_condition, 'none');
  assert.equal(optimized.experiment.cache_condition, 'warm');
});

test('M7 #64 principal campaign script and npm entry', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['experiment:principal-campaign'], /run-principal-campaign/);
  const sh = readFileSync(join(root, 'experiment/campaign/run-principal-campaign.sh'), 'utf8');
  assert.match(sh, /run-principal-campaign\.mjs/);
});
