import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { summarizeValidPairs } from '../experiment/repro/verify-valid-pair.mjs';

const root = join(import.meta.dirname, '..');

test('M7 #69 runbook documents clean state to one valid smoke pair', () => {
  const md = readFileSync(join(root, 'docs/runbooks/reproducibility-walkthrough.md'), 'utf8');
  assert.match(md, /repro-walkthrough-001/);
  assert.match(md, /compose:baseline/);
  assert.match(md, /compose:optimized/);
  assert.match(md, /reproducibility-walkthrough-notes\.md/);
});

test('M7 #69 notes template is present for contributor sign-off', () => {
  const md = readFileSync(
    join(root, 'docs/milestones/reproducibility-walkthrough-notes.md'),
    'utf8',
  );
  assert.match(md, /Contributor/);
  assert.match(md, /repro-walkthrough-001/);
  assert.match(md, /Sign-off/);
});

test('M7 #69 summarizeValidPairs requires both legs valid', () => {
  const ok = summarizeValidPairs({
    outcomes: [
      { pair_id: 'p1', run_id: 'r-b', architecture: 'baseline', valid: true },
      { pair_id: 'p1', run_id: 'r-o', architecture: 'optimized', valid: true },
    ],
  });
  assert.equal(ok.valid_pairs, 1);
  assert.equal(ok.satisfied, true);

  const partial = summarizeValidPairs({
    outcomes: [
      { pair_id: 'p1', run_id: 'r-b', valid: true },
      { pair_id: 'p1', run_id: 'r-o', valid: false, invalid_reason: 'preflight' },
    ],
  });
  assert.equal(partial.valid_pairs, 0);
  assert.equal(partial.satisfied, false);
});

test('M7 #69 npm scripts for repro walkthrough gate', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['experiment:verify-repro-pair'], /verify-valid-pair/);
  assert.match(pkg.scripts['gate:m7-repro'], /m7-repro-walkthrough\.sh/);
  assert.match(pkg.scripts['test:repro-walkthrough'], /reproducibility-walkthrough\.test\.mjs/);
});

test('M7 #69 gate script runs dry-run smoke plan', () => {
  const gate = readFileSync(join(root, 'scripts/m7-repro-walkthrough.sh'), 'utf8');
  assert.match(gate, /test:repro-walkthrough/);
  assert.match(gate, /--dry-run/);
  assert.match(gate, /--smoke/);
  assert.match(gate, /verify-repro-pair/);
});
