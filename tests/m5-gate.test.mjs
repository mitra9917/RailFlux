import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { validateRunManifestPreflight } from '../infrastructure/scripts/aws-run-manifest.mjs';

const root = join(import.meta.dirname, '..');

test('M5 #55 example gate manifests preflight', () => {
  for (const file of ['m5-gate-baseline.example.yaml', 'm5-gate-optimized.example.yaml']) {
    const result = validateRunManifestPreflight(join(root, 'experiment', file));
    assert.equal(result.ok, true, file);
  }
  const baseline = validateRunManifestPreflight(
    join(root, 'experiment', 'm5-gate-baseline.example.yaml'),
  );
  const optimized = validateRunManifestPreflight(
    join(root, 'experiment', 'm5-gate-optimized.example.yaml'),
  );
  assert.equal(baseline.config?.deploymentProfile, 'aws-baseline');
  assert.equal(optimized.config?.deploymentProfile, 'aws-optimized');
  assert.notEqual(baseline.config?.session, optimized.config?.session);
});

test('M5 #55 local gate script runs ci, cfn validate, and m5 tests', () => {
  const gate = readFileSync(join(root, 'scripts/m5-gate.sh'), 'utf8');
  assert.match(gate, /npm run ci/);
  assert.match(gate, /cfn:validate/);
  assert.match(gate, /test:m5-gate/);
});

test('M5 #55 AWS gate orchestrates baseline then optimized', () => {
  const awsGate = readFileSync(join(root, 'infrastructure/scripts/aws-m5-gate.sh'), 'utf8');
  assert.match(awsGate, /baseline-manifest/);
  assert.match(awsGate, /optimized-manifest/);
  assert.match(awsGate, /aws:deploy:session/);
  assert.match(awsGate, /aws:teardown:session/);
  assert.match(awsGate, /aws:audit:orphans/);
  assert.match(awsGate, /--dry-run|--execute/);
});
