import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { buildReportMarkdown } from '../experiment/report/build-report-markdown.mjs';
import {
  buildExperimentReportContext,
  renderExperimentReport,
} from '../experiment/report/generate-experiment-report.mjs';
import { evaluateDodEvidence } from '../experiment/report/dod-evidence.mjs';

const root = join(import.meta.dirname, '..');

test('M7 #68 DoD evidence flags missing measurements', () => {
  const dod = evaluateDodEvidence({
    dashboard: { pairs: [] },
    analysis: { metrics: [] },
    pairSummary: { valid: 0 },
    hasHypothesesFrozen: true,
    invalidArchiveCount: 0,
  });
  const outcomes = dod.find((d) => d.id === 'offered_terminal_outcomes');
  assert.equal(outcomes.satisfied, false);
  const noClaim = dod.find((d) => d.id === 'no_unmeasured_claims');
  assert.equal(noClaim.satisfied, true);
});

test('M7 #68 report markdown includes DoD section and limitations', () => {
  const md = buildReportMarkdown({
    campaignId: 'test-campaign',
    campaign: { plan: { event: 'principal_campaign_plan' } },
    dashboard: { pairs: [], unmeasured_claims: ['cache_hit_ratio'] },
    analysis: { metrics: [], holm_secondary: [] },
    hypothesesMeta: { status: 'frozen', slo_capacity_offered_rps: 40 },
    provenance: {
      application_git_sha: 'abc',
      infrastructure_git_sha: 'abc',
      fixture_sha256: 'deadbeef',
      seeds: '1',
      region: 'ap-south-1',
      measurement_dates: '2026-01-01',
      valid_invalid_summary: '0 valid',
      validity_fixture: 'Not demonstrated',
      validity_generator: 'Not assessed',
    },
    workloadSummary: '- PT-005',
    invalidArchive: [],
    dodEvidence: evaluateDodEvidence({
      dashboard: { pairs: [] },
      analysis: null,
      pairSummary: { valid: 0 },
      hasHypothesesFrozen: true,
      invalidArchiveCount: 0,
    }),
    generated_at: '2026-01-01T00:00:00.000Z',
  });
  assert.match(md, /Definition of Done — Evidence/);
  assert.match(md, /Do not generalize to private IRCTC/);
  assert.match(md, /Not assessed in this export/);
});

test('M7 #68 buildExperimentReportContext from campaign plan', () => {
  const campaign = {
    plan: {
      campaign_id: 'ci-fixture-campaign',
      event: 'principal_campaign_plan',
      duration_seconds: 180,
      cells: ['C1-L80-legit'],
      pairs: [
        {
          pair_id: 'C1-L80-legit-r01',
          cell_id: 'C1-L80-legit',
          load_level: 'L80',
          randomization_seed: 880001,
          manifests: [
            {
              architecture: 'baseline',
              run_id: 'ci-fixture-campaign-C1-L80-legit-r01-baseline',
              deployment: { application_region: 'ap-south-1' },
              versions: { application_git_sha: 'abc', infrastructure_git_sha: 'abc' },
              fixture: { sha256: 'fixture-sha', request_seed: 880001 },
              experiment: { duration_seconds: 180 },
            },
            {
              architecture: 'optimized',
              run_id: 'ci-fixture-campaign-C1-L80-legit-r01-optimized',
              deployment: { application_region: 'ap-south-1' },
              versions: { application_git_sha: 'abc', infrastructure_git_sha: 'abc' },
              fixture: { sha256: 'fixture-sha', request_seed: 880001 },
              experiment: { duration_seconds: 180 },
            },
          ],
        },
      ],
    },
  };
  const ctx = buildExperimentReportContext({
    campaign,
    runsDir: join(root, 'experiment/runs'),
    hypothesesPath: join(root, 'experiment/hypotheses.yaml'),
  });
  assert.equal(ctx.campaignId, 'ci-fixture-campaign');
  assert.equal(ctx.hypothesesMeta.status, 'frozen');
  const md = renderExperimentReport(ctx);
  assert.match(md, /ci-fixture-campaign/);
});

test('M7 #68 npm script entry', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['experiment:generate-report'], /run-generate-report/);
});
