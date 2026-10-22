#!/usr/bin/env node
/**
 * Generate experiment report from template sections (M7 #68).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectPrincipalPairs } from '../analysis/load-pairs.mjs';
import { parseHypothesesCalibration } from '../campaign/read-hypotheses.mjs';
import { buildDashboardData } from '../dashboard/build-dashboard-data.mjs';
import { buildReportMarkdown } from './build-report-markdown.mjs';
import { evaluateDodEvidence } from './dod-evidence.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_RUNS = path.join(REPO_ROOT, 'experiment/runs');
const DEFAULT_OUT = path.join(REPO_ROOT, 'experiment/reports');
const DEFAULT_HYPOTHESES = path.join(REPO_ROOT, 'experiment/hypotheses.yaml');

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function gitHead() {
  const res = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return res.status === 0 ? res.stdout.trim() : null;
}

function firstManifest(campaign) {
  const pair = campaign?.plan?.pairs?.[0];
  return pair?.manifests?.[0] ?? null;
}

function collectSeeds(campaign) {
  const seeds = new Set();
  for (const pair of campaign?.plan?.pairs ?? []) {
    if (pair.randomization_seed != null) seeds.add(pair.randomization_seed);
    for (const m of pair.manifests ?? []) {
      if (m.fixture?.request_seed != null) seeds.add(m.fixture.request_seed);
    }
  }
  return [...seeds].slice(0, 12).join(', ') + (seeds.size > 12 ? ', …' : '');
}

function workloadSummaryFromPlan(campaign, calibration) {
  const cells = campaign?.plan?.cells ?? [];
  const rates = calibration?.progressive_load_rps;
  return bulletLines([
    `Open-model k6 PT-005 + PT-006 (contention inventory); duration ${campaign?.plan?.duration_seconds ?? 180}s per manifest.`,
    `Cells: ${cells.join(', ') || '—'}.`,
    rates
      ? `Frozen progressive RPS: L50=${rates.pct_50}, L80=${rates.pct_80}, L110=${rates.pct_110}.`
      : 'Load levels: see hypotheses.yaml.',
    'Cohort mix, WAF, and cache condition: per-cell manifests under experiment/campaigns/<id>/manifests/.',
    'Payment: deterministic stub from fixture manifest; retries per workload-model.md.',
  ]);
}

function bulletLines(items) {
  return items.map((i) => `- ${i}`).join('\n');
}

function collectInvalidArchive(campaign, pairRecords) {
  /** @type {object[]} */
  const out = [...(campaign?.invalid_archive ?? [])];
  for (const o of campaign?.outcomes ?? []) {
    if (o.valid === false) {
      out.push({ run_id: o.run_id, pair_id: o.pair_id, reason: o.invalid_reason });
    }
  }
  for (const rec of pairRecords) {
    if (rec.status === 'invalid_run') {
      out.push({
        run_id: `${rec.baseline_run_id} / ${rec.optimized_run_id}`,
        pair_id: rec.pair_id,
        reason: 'invalid_run',
      });
    }
  }
  return out;
}

/**
 * @param {object} options
 */
export function buildExperimentReportContext(options) {
  const {
    campaign,
    runsDir = DEFAULT_RUNS,
    analysisReport = null,
    dashboardData = null,
    hypothesesPath = DEFAULT_HYPOTHESES,
  } = options;

  const campaignId = campaign?.plan?.campaign_id ?? 'unknown-campaign';
  const pairRecords = collectPrincipalPairs(campaign, runsDir);
  const dashboard =
    dashboardData ??
    buildDashboardData({
      campaign,
      pairRecords,
      analysisReport,
      hypothesesPath,
    });

  const hypText = fs.readFileSync(hypothesesPath, 'utf8');
  const calibration = parseHypothesesCalibration(hypText);
  const manifest0 = firstManifest(campaign);
  const valid = pairRecords.filter((r) => r.status === 'valid').length;
  const invalid = pairRecords.filter((r) => r.status === 'invalid_run').length;
  const missing = pairRecords.filter((r) => r.status === 'missing_results').length;
  const invalidArchive = collectInvalidArchive(campaign, pairRecords);

  const dodEvidence = evaluateDodEvidence({
    dashboard,
    analysis: analysisReport,
    pairSummary: dashboard.pair_summary,
    hasHypothesesFrozen: calibration.frozen,
    invalidArchiveCount: invalidArchive.length,
  });

  return {
    campaignId,
    campaign,
    dashboard,
    analysis: analysisReport,
    hypothesesMeta: {
      schema_version: '1.0',
      status: calibration.status,
      pilot_run_id: hypText.match(/pilot_run_id:\s*"([^"]+)"/)?.[1],
      slo_capacity_offered_rps: calibration.slo_capacity_offered_rps,
    },
    provenance: {
      application_git_sha: manifest0?.versions?.application_git_sha ?? gitHead(),
      infrastructure_git_sha: manifest0?.versions?.infrastructure_git_sha ?? gitHead(),
      fixture_sha256: manifest0?.fixture?.sha256 ?? '—',
      seeds: collectSeeds(campaign) || '—',
      region: manifest0?.deployment?.application_region ?? '—',
      measurement_dates: campaign?.completed_at ?? dashboard.generated_at ?? '—',
      valid_invalid_summary: `${valid} valid pairs, ${invalid} invalid, ${missing} missing results (${pairRecords.length} pair slots)`,
      validity_fixture: valid > 0 ? 'Passed on valid runs (per result export)' : 'Not demonstrated',
      validity_generator: invalid > 0 ? 'Some runs failed generator or workload gates' : 'Not assessed',
    },
    workloadSummary: workloadSummaryFromPlan(campaign, calibration),
    invalidArchive,
    dodEvidence,
    generated_at: new Date().toISOString(),
  };
}

export function renderExperimentReport(context) {
  return buildReportMarkdown(context);
}

function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const out = {
    campaignPath: '',
    runsDir: DEFAULT_RUNS,
    analysisPath: '',
    dashboardPath: '',
    outPath: '',
    hypothesesPath: DEFAULT_HYPOTHESES,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--campaign' && argv[i + 1]) out.campaignPath = argv[++i];
    else if (a === '--runs' && argv[i + 1]) out.runsDir = argv[++i];
    else if (a === '--analysis' && argv[i + 1]) out.analysisPath = argv[++i];
    else if (a === '--dashboard' && argv[i + 1]) out.dashboardPath = argv[++i];
    else if (a === '--out' && argv[i + 1]) out.outPath = argv[++i];
    else if (a === '--hypotheses' && argv[i + 1]) out.hypothesesPath = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function defaultArtifactPath(baseDir, campaignId, suffix) {
  return path.join(baseDir, `${campaignId}${suffix}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.campaignPath) {
    console.log(`Usage: generate-experiment-report.mjs --campaign PATH [--analysis PATH] [--dashboard PATH] [--runs DIR] [--out PATH] [--dry-run]`);
    process.exit(args.help ? 0 : 1);
  }

  const campaign = JSON.parse(fs.readFileSync(path.resolve(args.campaignPath), 'utf8'));
  const campaignId = campaign?.plan?.campaign_id ?? path.basename(args.campaignPath, '.json');

  const analysisPath =
    args.analysisPath ||
    defaultArtifactPath(path.join(REPO_ROOT, 'experiment/analysis/output'), campaignId, '-analysis.json');
  const dashboardPath =
    args.dashboardPath ||
    defaultArtifactPath(path.join(REPO_ROOT, 'experiment/dashboard/output'), campaignId, '-dashboard.json');

  const analysisReport = readJsonIfExists(path.resolve(analysisPath));
  const dashboardData = readJsonIfExists(path.resolve(dashboardPath));

  const context = buildExperimentReportContext({
    campaign,
    runsDir: path.resolve(args.runsDir),
    analysisReport,
    dashboardData,
    hypothesesPath: path.resolve(args.hypothesesPath),
  });

  const markdown = renderExperimentReport(context);
  const outPath =
    args.outPath || path.join(DEFAULT_OUT, `${context.campaignId}-report.md`);

  if (!args.dryRun) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, markdown, 'utf8');
  }

  const dodSatisfied = context.dodEvidence.filter((d) => d.satisfied).length;
  console.log(
    JSON.stringify({
      event: 'experiment_report_generated',
      campaign_id: context.campaignId,
      path: args.dryRun ? null : outPath,
      dod_evidence_satisfied: `${dodSatisfied}/${context.dodEvidence.length}`,
      valid_pairs: context.dashboard.pair_summary.valid,
    }),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main();
}
