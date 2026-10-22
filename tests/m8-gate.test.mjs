import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { evaluateM8Signoff, M8_SIGNOFF_KEYS } from '../experiment/gate/evaluate-m8-signoff.mjs';

const root = join(import.meta.dirname, '..');

test('M8 #75 signoff requires all checklist keys checked', () => {
  const partial = M8_SIGNOFF_KEYS.map((k, i) => `- [${i === 0 ? 'x' : ' '}] ${k}`).join('\n');
  assert.equal(evaluateM8Signoff(partial).satisfied, false);

  const complete = M8_SIGNOFF_KEYS.map((k) => `- [x] ${k}`).join('\n');
  assert.equal(evaluateM8Signoff(complete).satisfied, true);
});

test('M8 #75 gate script runs ci, frontend build, and m8 tests', () => {
  const gate = readFileSync(join(root, 'scripts/m8-gate.sh'), 'utf8');
  assert.match(gate, /npm run ci/);
  assert.match(gate, /build:frontend/);
  assert.match(gate, /test:m8-gate/);
  assert.match(gate, /test:m8-simulator-flow/);
  assert.match(gate, /verify-m8-acceptance/);
});

test('M8 #75 package exposes gate:m8, test:m8-gate, and verify script', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['gate:m8'], /m8-gate\.sh/);
  assert.match(pkg.scripts['test:m8-gate'], /m8-gate\.test\.mjs/);
  assert.match(pkg.scripts['test:m8-simulator-flow'], /m8-simulator-flow/);
  assert.match(pkg.scripts['experiment:verify-m8-acceptance'], /verify-m8-acceptance/);
});

test('M8 #75 runbook and sign-off template exist', () => {
  const runbook = readFileSync(join(root, 'docs/runbooks/m8-gate.md'), 'utf8');
  assert.match(runbook, /gate:m8/);
  const signoff = readFileSync(join(root, 'docs/milestones/M8-gate-signoff.md'), 'utf8');
  for (const key of M8_SIGNOFF_KEYS) {
    assert.match(signoff, new RegExp(key));
  }
});
