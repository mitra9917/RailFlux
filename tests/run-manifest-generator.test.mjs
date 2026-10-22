import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  architecturesForPairOrder,
  assertTemplateStructure,
  buildRunManifest,
  generatePairManifests,
  pairOrderFromSeed,
  renderRunManifestYaml,
  RUN_MANIFEST_TEMPLATE_KEYS,
} from '../experiment/controller/generate-run-manifest.mjs';
import { parseControllerManifestText } from '../experiment/controller/parse-run-manifest.mjs';

const root = join(import.meta.dirname, '..');
const templateText = readFileSync(join(root, 'experiment/run-manifest.template.yaml'), 'utf8');

test('M6 #59 template keys cover run-manifest.template.yaml sections', () => {
  for (const key of RUN_MANIFEST_TEMPLATE_KEYS) {
    if (key === 'schema_version') {
      assert.match(templateText, /^schema_version:/m);
    } else {
      assert.match(templateText, new RegExp(`^${key}:`, 'm'), `missing ${key} in template`);
    }
  }
});

test('M6 #59 pair order from randomization seed is deterministic', () => {
  assert.equal(pairOrderFromSeed(772910), 'AB');
  assert.equal(pairOrderFromSeed(772911), 'BA');
  assert.deepEqual(architecturesForPairOrder('AB'), ['baseline', 'optimized']);
  assert.deepEqual(architecturesForPairOrder('BA'), ['optimized', 'baseline']);
});

test('M6 #59 generatePairManifests sets waf and cache fields', () => {
  const [first] = generatePairManifests({
    pairId: 'pair-test',
    randomizationSeed: 1,
    sessionName: 'lab-test',
    wafMode: 'on',
    cacheCondition: 'warm',
  });
  assert.equal(first.pair_order, 'BA');
  assert.equal(first.experiment.waf_mode, 'on');
  assert.equal(first.experiment.cache_condition, 'warm');
  assert.equal(first.fixture.request_seed, 1);
  assertTemplateStructure(first);
});

test('M6 #59 rendered YAML round-trips through controller parser', () => {
  const manifest = buildRunManifest({
    runId: 'run-pair-001-baseline',
    pairId: 'pair-001',
    pairOrder: 'AB',
    architecture: 'baseline',
    sessionName: 'lab-example',
    randomizationSeed: 772910,
    requestSeed: 772910,
    wafMode: 'off',
    cacheCondition: 'cold',
  });
  const yaml = renderRunManifestYaml(manifest);
  const parsed = parseControllerManifestText(yaml);
  assert.equal(parsed.pairId, 'pair-001');
  assert.equal(parsed.pairOrder, 'AB');
  assert.equal(parsed.architecture, 'baseline');
  assert.equal(parsed.cacheCondition, 'cold');
  assert.equal(parsed.wafMode, 'off');
  assert.equal(parsed.requestSeed, 772910);
});

test('M6 #59 npm script documents generator', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['experiment:generate-manifest'], /generate-run-manifest/);
});
