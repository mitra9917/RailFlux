#!/usr/bin/env node
/**
 * Sequential selected failure-test campaign at ~80% load (M7 #65).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertTemplateStructure,
  buildRunManifest,
  renderRunManifestYaml,
} from '../controller/generate-run-manifest.mjs';
import { loadHypothesesCalibration } from './read-hypotheses.mjs';
import {
  cacheConditionForFailureRun,
  DEFAULT_FAILURE_INJECTION_OFFSET_SECONDS,
  FAILURE_TESTS,
  selectFailureTests,
} from './failure-tests.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RUNS_DIR = path.join(REPO_ROOT, 'experiment/runs');
const CAMPAIGNS_DIR = path.join(REPO_ROOT, 'experiment/campaigns');
const CONTROLLER = path.join(REPO_ROOT, 'experiment/controller/run.sh');

export const DEFAULT_FAILURE_DURATION_SECONDS = 180;
export const SMOKE_FAILURE_DURATION_SECONDS = 60;
export const SMOKE_FAILURE_INJECTION_OFFSET_SECONDS = 20;

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
export function buildFailureCampaignPlan(options) {
  const {
    campaignId = 'failure-local-001',
    sessionName = 'failure-campaign',
    baseSeed = 890001,
    testIds = [],
    maxRuns = null,
    durationSeconds = DEFAULT_FAILURE_DURATION_SECONDS,
    injectionOffsetSeconds = DEFAULT_FAILURE_INJECTION_OFFSET_SECONDS,
  } = options;

  const tests = selectFailureTests(FAILURE_TESTS, testIds);
  /** @type {object[]} */
  const runs = [];

  tests.forEach((test, testIdx) => {
    for (const architecture of test.architectures) {
      const randomizationSeed = baseSeed + testIdx * 1000 + (architecture === 'optimized' ? 1 : 0);
      const runId = `${campaignId}-${test.id}-${architecture}`.toLowerCase();
      const manifest = buildRunManifest({
        runId,
        pairId: `${test.id}-${architecture}`,
        pairOrder: 'AB',
        architecture,
        sessionName: `${sessionName}-${campaignId}`,
        randomizationSeed,
        requestSeed: randomizationSeed,
        loadLevel: 'failure',
        inventoryProfile: 'contention',
        cohortMix: { legitimate: 1, bot_like: 0 },
        cacheCondition: cacheConditionForFailureRun(test, architecture),
        durationSeconds,
        failureInjection: {
          enabled: true,
          type: test.type,
          offset_seconds: injectionOffsetSeconds,
          failure_test_id: test.id,
        },
      });
      assertTemplateStructure(manifest);
      runs.push({
        run_id: runId,
        failure_test_id: test.id,
        failure_injection_type: test.type,
        architecture,
        randomization_seed: randomizationSeed,
        injection_offset_seconds: injectionOffsetSeconds,
        load_level: 'failure',
        manifest,
      });
    }
  });

  const limited = maxRuns != null && maxRuns > 0 ? runs.slice(0, maxRuns) : runs;
  return {
    event: 'failure_campaign_plan',
    campaign_id: campaignId,
    session_name: sessionName,
    test_ids: tests.map((t) => t.id),
    run_count: limited.length,
    duration_seconds: durationSeconds,
    injection_offset_seconds: injectionOffsetSeconds,
    runs: limited,
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
 * @param {object} plan
 * @param {object} options
 */
export function executeFailureCampaignPlan(plan, options = {}) {
  const { baseUrl = 'http://127.0.0.1:3000', dryRun = false, manifestDir } = options;
  const sha = options.fixtureSha256 ?? fixtureSha256();
  const gitSha = options.applicationGitSha ?? gitHeadSha();
  fs.mkdirSync(manifestDir, { recursive: true });

  /** @type {object[]} */
  const outcomes = [];

  for (const run of plan.runs) {
    const manifest = run.manifest;
    manifest.fixture.sha256 = sha;
    manifest.versions.application_git_sha = gitSha;
    manifest.versions.infrastructure_git_sha = gitSha;

    const manifestPath = path.join(manifestDir, `${manifest.run_id}.yaml`);
    fs.writeFileSync(manifestPath, renderRunManifestYaml(manifest), 'utf8');

    console.log(
      JSON.stringify({
        event: 'failure_campaign_run_start',
        campaign_id: plan.campaign_id,
        failure_test_id: run.failure_test_id,
        run_id: manifest.run_id,
        architecture: manifest.architecture,
        failure_injection_type: run.failure_injection_type,
        injection_offset_seconds: run.injection_offset_seconds,
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
      failure_test_id: run.failure_test_id,
      run_id: manifest.run_id,
      architecture: manifest.architecture,
      failure_injection_type: run.failure_injection_type,
      ...outcome,
      controller_exit: res.status,
    });

    if (!dryRun && res.status !== 0 && outcome.valid) {
      outcomes[outcomes.length - 1].invalid_reason =
        outcome.invalid_reason || 'controller_exit_nonzero';
      outcomes[outcomes.length - 1].valid = false;
    }
  }

  const validRuns = outcomes.filter((o) => o.valid).length;
  const invalidRuns = outcomes.filter((o) => !o.valid);

  return {
    event: 'failure_campaign_complete',
    campaign_id: plan.campaign_id,
    completed_at: new Date().toISOString(),
    runs_total: outcomes.length,
    runs_valid: validRuns,
    runs_invalid: invalidRuns.length,
    outcomes,
    invalid_archive: invalidRuns.map((o) => ({
      run_id: o.run_id,
      failure_test_id: o.failure_test_id,
      reason: o.invalid_reason,
      index_path: o.path ?? null,
    })),
  };
}

function parseArgs(argv) {
  /** @type {Record<string, string | boolean | number | string[]>} */
  const out = {
    campaignId: 'failure-local-001',
    sessionName: 'failure-campaign',
    baseUrl: process.env.BASE_URL || 'http://127.0.0.1:3000',
    baseSeed: 890001,
    dryRun: false,
    maxRuns: null,
    testIds: [],
    durationSeconds: DEFAULT_FAILURE_DURATION_SECONDS,
    injectionOffsetSeconds: DEFAULT_FAILURE_INJECTION_OFFSET_SECONDS,
    smoke: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--campaign-id' && argv[i + 1]) out.campaignId = argv[++i];
    else if (a === '--session-name' && argv[i + 1]) out.sessionName = argv[++i];
    else if (a === '--base-url' && argv[i + 1]) out.baseUrl = argv[++i];
    else if (a === '--base-seed' && argv[i + 1]) out.baseSeed = Number(argv[++i]);
    else if (a === '--max-runs' && argv[i + 1]) out.maxRuns = Number(argv[++i]);
    else if (a === '--tests' && argv[i + 1]) {
      out.testIds = argv[++i].split(',').filter(Boolean);
    } else if (a === '--duration-seconds' && argv[i + 1]) {
      out.durationSeconds = Number(argv[++i]);
    } else if (a === '--injection-offset-seconds' && argv[i + 1]) {
      out.injectionOffsetSeconds = Number(argv[++i]);
    } else if (a === '--smoke') out.smoke = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  if (out.smoke) {
    out.durationSeconds = SMOKE_FAILURE_DURATION_SECONDS;
    out.injectionOffsetSeconds = SMOKE_FAILURE_INJECTION_OFFSET_SECONDS;
    if (!out.maxRuns) out.maxRuns = 1;
    if (!out.testIds.length) out.testIds = ['FT-005'];
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: run-failure-campaign.mjs [options]
  --campaign-id ID   --session-name NAME   --base-url URL
  --tests FT-001,FT-005,...   (default: all selected FTs)
  --max-runs N (budget reduction)
  --duration-seconds N (default 180; smoke 60)
  --injection-offset-seconds N (default 60; smoke 20)
  --smoke   FT-005 baseline run, 60s, offset 20s (local only)
  --dry-run`);
    process.exit(0);
  }

  const calibration = loadHypothesesCalibration(process.env.HYPOTHESES_PATH);
  if (!calibration.frozen) {
    console.error(
      JSON.stringify({
        event: 'failure_campaign_failed',
        reason: 'hypotheses_not_frozen',
        status: calibration.status,
      }),
    );
    process.exit(1);
  }

  const plan = buildFailureCampaignPlan({
    campaignId: args.campaignId,
    sessionName: args.sessionName,
    baseSeed: args.baseSeed,
    testIds: args.testIds,
    maxRuns: args.maxRuns,
    durationSeconds: args.durationSeconds,
    injectionOffsetSeconds: args.injectionOffsetSeconds,
  });

  const manifestDir = path.join(CAMPAIGNS_DIR, args.campaignId, 'manifests');
  const result = executeFailureCampaignPlan(plan, {
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
      failure_load_rps: calibration.progressive_load_rps.pct_80,
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
