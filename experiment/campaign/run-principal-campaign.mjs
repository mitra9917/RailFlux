#!/usr/bin/env node
/**
 * Sequential principal paired campaign (M7 #64).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertTemplateStructure,
  generatePairManifests,
  renderRunManifestYaml,
} from '../controller/generate-run-manifest.mjs';
import { loadHypothesesCalibration } from './read-hypotheses.mjs';
import {
  DEFAULT_REPETITIONS,
  PRINCIPAL_CELLS,
  selectPrincipalCells,
} from './principal-cells.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RUNS_DIR = path.join(REPO_ROOT, 'experiment/runs');
const CAMPAIGNS_DIR = path.join(REPO_ROOT, 'experiment/campaigns');
const CONTROLLER = path.join(REPO_ROOT, 'experiment/controller/run.sh');

function gitHeadSha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'TO_SET';
}

function fixtureSha256() {
  const result = spawnSync('node', [path.join(REPO_ROOT, 'database/scripts/verify-fixture.mjs')], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) return 'TO_SET';
  try {
    return JSON.parse(result.stdout).fixture_sha256 || 'TO_SET';
  } catch {
    return 'TO_SET';
  }
}

/**
 * @param {object} options
 */
export function buildCampaignPlan(options) {
  const {
    campaignId = 'principal-local-001',
    sessionName = 'principal-campaign',
    baseSeed = 880001,
    repetitions = DEFAULT_REPETITIONS,
    cellIds = [],
    maxPairs = null,
  } = options;

  const cells = selectPrincipalCells(PRINCIPAL_CELLS, cellIds);
  /** @type {object[]} */
  const pairs = [];

  cells.forEach((cell, cellIdx) => {
    for (let rep = 0; rep < repetitions; rep += 1) {
      const randomizationSeed = baseSeed + cellIdx * 10_000 + rep;
      const pairId = `${cell.id}-r${String(rep + 1).padStart(2, '0')}`;
      const manifests = generatePairManifests({
        pairId,
        randomizationSeed,
        sessionName: `${sessionName}-${campaignId}`,
        wafMode: cell.wafMode,
        loadLevel: cell.loadLevel,
        inventoryProfile: cell.inventoryProfile,
        cohortMix: cell.cohortMix,
        cacheConditionByArchitecture: cell.cacheConditionByArchitecture,
        durationSeconds: 180,
        runIdPattern: (architecture) => `${campaignId}-${pairId}-${architecture}`,
      });
      for (const m of manifests) assertTemplateStructure(m);
      pairs.push({
        pair_id: pairId,
        cell_id: cell.id,
        repetition: rep + 1,
        randomization_seed: randomizationSeed,
        pair_order: manifests[0]?.pair_order,
        load_level: cell.loadLevel,
        waf_mode: cell.wafMode,
        cohort_mix: cell.cohortMix,
        manifests,
      });
    }
  });

  const limited = maxPairs != null && maxPairs > 0 ? pairs.slice(0, maxPairs) : pairs;
  return {
    event: 'principal_campaign_plan',
    campaign_id: campaignId,
    session_name: sessionName,
    repetitions_per_cell: repetitions,
    cells: cells.map((c) => c.id),
    pair_count: limited.length,
    run_count: limited.length * 2,
    pairs: limited,
  };
}

function readRunIndex(runId) {
  const indexPath = path.join(RUNS_DIR, `${runId}.json`);
  if (!fs.existsSync(indexPath)) {
    return { run_id: runId, valid: false, invalid_reason: 'missing_run_index', path: indexPath };
  }
  const record = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  return {
    run_id: runId,
    valid: Boolean(record.valid),
    invalid_reason: record.invalid_reason ?? null,
    path: indexPath,
    architecture: record.architecture ?? null,
  };
}

function runController(manifestPath, baseUrl, dryRun) {
  const args = ['--manifest', manifestPath, '--base-url', baseUrl, '--workload', 'manifest'];
  if (dryRun) args.push('--dry-run');
  return spawnSync('bash', [CONTROLLER, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: dryRun ? 'pipe' : 'inherit',
    env: { ...process.env },
  });
}

/**
 * @param {object} options
 */
export function executeCampaignPlan(plan, options = {}) {
  const { baseUrl = 'http://127.0.0.1:3000', dryRun = false, manifestDir } = options;
  const sha = options.fixtureSha256 ?? fixtureSha256();
  const gitSha = options.applicationGitSha ?? gitHeadSha();
  fs.mkdirSync(manifestDir, { recursive: true });

  /** @type {object[]} */
  const outcomes = [];

  for (const pair of plan.pairs) {
    for (const manifest of pair.manifests) {
      manifest.fixture.sha256 = sha;
      manifest.versions.application_git_sha = gitSha;
      manifest.versions.infrastructure_git_sha = gitSha;

      const manifestPath = path.join(manifestDir, `${manifest.run_id}.yaml`);
      fs.writeFileSync(manifestPath, renderRunManifestYaml(manifest), 'utf8');

      console.log(
        JSON.stringify({
          event: 'principal_campaign_leg_start',
          campaign_id: plan.campaign_id,
          pair_id: pair.pair_id,
          run_id: manifest.run_id,
          architecture: manifest.architecture,
        }),
      );

      const res = runController(manifestPath, baseUrl, dryRun);
      const outcome = dryRun
        ? {
            run_id: manifest.run_id,
            valid: true,
            invalid_reason: null,
            dry_run: true,
            exit_code: res.status,
          }
        : readRunIndex(manifest.run_id);

      outcomes.push({
        pair_id: pair.pair_id,
        cell_id: pair.cell_id,
        run_id: manifest.run_id,
        architecture: manifest.architecture,
        cache_condition: manifest.experiment.cache_condition,
        ...outcome,
        controller_exit: res.status,
      });

      if (!dryRun && res.status !== 0 && outcome.valid) {
        outcomes[outcomes.length - 1].invalid_reason =
          outcome.invalid_reason || 'controller_exit_nonzero';
        outcomes[outcomes.length - 1].valid = false;
      }
    }
  }

  const validRuns = outcomes.filter((o) => o.valid).length;
  const invalidRuns = outcomes.filter((o) => !o.valid);

  return {
    event: 'principal_campaign_complete',
    campaign_id: plan.campaign_id,
    completed_at: new Date().toISOString(),
    runs_total: outcomes.length,
    runs_valid: validRuns,
    runs_invalid: invalidRuns.length,
    pairs_total: plan.pair_count,
    outcomes,
    invalid_archive: invalidRuns.map((o) => ({
      run_id: o.run_id,
      pair_id: o.pair_id,
      reason: o.invalid_reason,
      index_path: o.path ?? null,
    })),
  };
}

function parseArgs(argv) {
  /** @type {Record<string, string | boolean | number | string[]>} */
  const out = {
    campaignId: 'principal-local-001',
    sessionName: 'principal-campaign',
    baseUrl: process.env.BASE_URL || 'http://127.0.0.1:3000',
    repetitions: DEFAULT_REPETITIONS,
    baseSeed: 880001,
    dryRun: false,
    maxPairs: null,
    cellIds: [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--campaign-id' && argv[i + 1]) out.campaignId = argv[++i];
    else if (a === '--session-name' && argv[i + 1]) out.sessionName = argv[++i];
    else if (a === '--base-url' && argv[i + 1]) out.baseUrl = argv[++i];
    else if (a === '--reps' && argv[i + 1]) out.repetitions = Number(argv[++i]);
    else if (a === '--base-seed' && argv[i + 1]) out.baseSeed = Number(argv[++i]);
    else if (a === '--max-pairs' && argv[i + 1]) out.maxPairs = Number(argv[++i]);
    else if (a === '--cells' && argv[i + 1]) out.cellIds = argv[++i].split(',').filter(Boolean);
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: run-principal-campaign.mjs [options]
  --campaign-id ID   --session-name NAME   --base-url URL
  --reps N (default 5)   --max-pairs N (budget reduction)
  --cells C1-L80-legit,C2-L110-legit,...   --dry-run`);
    process.exit(0);
  }

  const calibration = loadHypothesesCalibration(process.env.HYPOTHESES_PATH);
  if (!calibration.frozen) {
    console.error(
      JSON.stringify({
        event: 'principal_campaign_failed',
        reason: 'hypotheses_not_frozen',
        status: calibration.status,
      }),
    );
    process.exit(1);
  }

  const plan = buildCampaignPlan({
    campaignId: args.campaignId,
    sessionName: args.sessionName,
    baseSeed: args.baseSeed,
    repetitions: args.repetitions,
    cellIds: args.cellIds,
    maxPairs: args.maxPairs,
  });

  const manifestDir = path.join(CAMPAIGNS_DIR, args.campaignId, 'manifests');
  const result = executeCampaignPlan(plan, {
    baseUrl: args.baseUrl,
    dryRun: args.dryRun,
    manifestDir,
  });

  fs.mkdirSync(CAMPAIGNS_DIR, { recursive: true });
  const outPath = path.join(CAMPAIGNS_DIR, `${args.campaignId}.json`);
  const payload = {
    plan,
    calibration: {
      slo_capacity_offered_rps: calibration.slo_capacity_offered_rps,
      progressive_load_rps: calibration.progressive_load_rps,
    },
    ...result,
  };
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ ...result, campaign_path: outPath }));

  const allValid = result.runs_invalid === 0;
  process.exit(allValid || args.dryRun ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
