import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  evaluateM7CampaignAcceptance,
  evaluatePrincipalCampaignScope,
  FULL_PRINCIPAL_PAIR_COUNT,
  validPairsPerCell,
} from '../experiment/gate/evaluate-m7-campaign.mjs';
import { evaluateM7Signoff, M7_SIGNOFF_KEYS } from '../experiment/gate/evaluate-m7-signoff.mjs';

const root = join(import.meta.dirname, '..');

function fullCampaignFixture(validPerCell = 5) {
  const cells = ['C1-L80-legit', 'C2-L110-legit', 'C3-L80-mixed', 'C4-L110-mixed'];
  /** @type {object[]} */
  const outcomes = [];
  for (const cellId of cells) {
    for (let rep = 1; rep <= validPerCell; rep += 1) {
      const pairId = `${cellId}-r${String(rep).padStart(2, '0')}`;
      outcomes.push(
        { pair_id: pairId, cell_id: cellId, architecture: 'baseline', valid: true },
        { pair_id: pairId, cell_id: cellId, architecture: 'optimized', valid: true },
      );
    }
  }
  return {
    completed_at: '2026-01-01T00:00:00.000Z',
    runs_total: outcomes.length,
    plan: {
      campaign_id: 'principal-full-fixture',
      pair_count: cells.length * validPerCell,
      repetitions_per_cell: 5,
      cells,
    },
    outcomes,
  };
}

test('M7 #70 protocol full pair count is 20', () => {
  assert.equal(FULL_PRINCIPAL_PAIR_COUNT, 20);
});

test('M7 #70 evaluateM7CampaignAcceptance accepts protocol-full campaign', () => {
  const campaign = fullCampaignFixture(5);
  const evalResult = evaluateM7CampaignAcceptance(campaign);
  assert.equal(evalResult.mode, 'protocol_full');
  assert.equal(evalResult.satisfied, true);
  assert.equal(validPairsPerCell(campaign).get('C1-L80-legit'), 5);
});

test('M7 #70 budget-reduced campaign requires amendment referencing campaign id', () => {
  const campaign = fullCampaignFixture(1);
  campaign.plan.pair_count = 1;
  campaign.plan.cells = ['C1-L80-legit'];
  campaign.plan.repetitions_per_cell = 1;
  campaign.outcomes = campaign.outcomes.slice(0, 2);
  campaign.runs_total = 2;
  campaign.plan.campaign_id = 'principal-reduced-fixture';

  const without = evaluateM7CampaignAcceptance(campaign);
  assert.equal(without.satisfied, false);
  assert.equal(without.budget_amendment_required, true);

  const amendmentDir = mkdtempSync(join(tmpdir(), 'm7-amend-'));
  const amendmentPath = join(amendmentDir, 'amendment.md');
  writeFileSync(
    amendmentPath,
    '# Budget reduction\nCampaign ID: principal-reduced-fixture\nReason: local smoke budget amendment.\n',
  );
  const withAmendment = evaluateM7CampaignAcceptance(campaign, {
    budgetAmendmentPath: amendmentPath,
  });
  assert.equal(withAmendment.budget_amendment_ok, true);
  assert.equal(withAmendment.mode, 'budget_reduced');
  assert.equal(withAmendment.satisfied, true);
});

test('M7 #70 signoff requires all checklist keys checked', () => {
  const partial = M7_SIGNOFF_KEYS.map((k, i) => `- [${i === 0 ? 'x' : ' '}] ${k}`).join('\n');
  assert.equal(evaluateM7Signoff(partial).satisfied, false);

  const complete = M7_SIGNOFF_KEYS.map((k) => `- [x] ${k}`).join('\n');
  assert.equal(evaluateM7Signoff(complete).satisfied, true);
});

test('M7 #70 gate script runs ci, m7 tests, and repro gate', () => {
  const gate = readFileSync(join(root, 'scripts/m7-gate.sh'), 'utf8');
  assert.match(gate, /npm run ci/);
  assert.match(gate, /test:m7-gate/);
  assert.match(gate, /gate:m7-repro/);
  assert.match(gate, /verify-m7-acceptance/);
});

test('M7 #70 scope helper reads plan metadata', () => {
  const scope = evaluatePrincipalCampaignScope(fullCampaignFixture(5));
  assert.equal(scope.planned_pairs, 20);
  assert.equal(scope.is_protocol_full_plan, true);
});

test('M7 #70 package exposes gate:m7 and test:m7-gate', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['gate:m7'], /m7-gate\.sh/);
  assert.match(pkg.scripts['test:m7-gate'], /m7-gate\.test\.mjs/);
  assert.match(pkg.scripts['experiment:verify-m7-acceptance'], /verify-m7-acceptance/);
});
