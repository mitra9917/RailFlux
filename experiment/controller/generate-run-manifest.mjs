#!/usr/bin/env node
/**
 * Generate paired run manifests with AB/BA order from randomization seed (M6 #59).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const TEMPLATE_PATH = path.join(REPO_ROOT, 'experiment/run-manifest.template.yaml');

/** Top-level keys in run-manifest.template.yaml (acceptance order). */
export const RUN_MANIFEST_TEMPLATE_KEYS = [
  'schema_version',
  'run_id',
  'deployment',
  'pair_id',
  'pair_order',
  'architecture',
  'versions',
  'fixture',
  'experiment',
  'resources',
  'cost',
  'failure_injection',
  'validity_gates',
  'artifacts',
];

/**
 * Deterministic AB/BA from recorded randomization seed (protocol step 2).
 * @param {number} randomizationSeed
 */
export function pairOrderFromSeed(randomizationSeed) {
  const n = Number(randomizationSeed);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('randomization_seed must be a non-negative integer');
  }
  return n % 2 === 0 ? 'AB' : 'BA';
}

/**
 * Run sequence architectures: A=baseline, B=optimized.
 * @param {'AB' | 'BA'} pairOrder
 * @returns {('baseline' | 'optimized')[]}
 */
export function architecturesForPairOrder(pairOrder) {
  if (pairOrder === 'BA') {
    return ['optimized', 'baseline'];
  }
  return ['baseline', 'optimized'];
}

function yamlString(value) {
  if (value === null || value === undefined) return '""';
  const s = String(value);
  if (/[:#"'{}[\],&*!?|>@%`]/.test(s) || s === '') {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

function yamlNumber(value) {
  return String(value);
}

/**
 * @param {object} manifest
 */
export function renderRunManifestYaml(manifest) {
  const m = manifest;
  const lines = [
    `schema_version: ${yamlString(m.schema_version)}`,
    `run_id: ${yamlString(m.run_id)}`,
    'deployment:',
    `  session_name: ${yamlString(m.deployment.session_name)}`,
    `  owner: ${yamlString(m.deployment.owner)}`,
    `  application_region: ${yamlString(m.deployment.application_region)}`,
    `pair_id: ${yamlString(m.pair_id)}`,
    `pair_order: ${m.pair_order}`,
    `architecture: ${m.architecture}`,
    'versions:',
    `  application_git_sha: ${yamlString(m.versions.application_git_sha)}`,
    `  infrastructure_git_sha: ${yamlString(m.versions.infrastructure_git_sha)}`,
    `  image_digest: ${yamlString(m.versions.image_digest)}`,
    'fixture:',
    `  id: ${yamlString(m.fixture.id)}`,
    `  sha256: ${yamlString(m.fixture.sha256)}`,
    `  request_seed: ${yamlNumber(m.fixture.request_seed)}`,
    'experiment:',
    `  inventory_profile: ${m.experiment.inventory_profile}`,
    `  cache_condition: ${m.experiment.cache_condition}`,
    `  load_level: ${m.experiment.load_level}`,
    `  waf_mode: ${yamlString(m.experiment.waf_mode)}`,
    '  autoscaling:',
    `    enabled: ${m.experiment.autoscaling.enabled}`,
    `    policy_id: ${m.experiment.autoscaling.policy_id}`,
    '  cohort_mix:',
    `    legitimate: ${m.experiment.cohort_mix.legitimate}`,
    `    bot_like: ${m.experiment.cohort_mix.bot_like}`,
    `  duration_seconds: ${yamlNumber(m.experiment.duration_seconds)}`,
    'resources:',
    `  request_serving_vcpu_max_total: ${yamlString(m.resources.request_serving_vcpu_max_total)}`,
    `  request_serving_memory_gib_max_total: ${yamlString(m.resources.request_serving_memory_gib_max_total)}`,
    '  services:',
    `    baseline: {max_tasks: ${m.resources.services.baseline.max_tasks}, vcpu_per_task: ${m.resources.services.baseline.vcpu_per_task}, memory_gib_per_task: ${m.resources.services.baseline.memory_gib_per_task}}`,
    `    read: {max_tasks: ${m.resources.services.read.max_tasks}, vcpu_per_task: ${m.resources.services.read.vcpu_per_task}, memory_gib_per_task: ${m.resources.services.read.memory_gib_per_task}}`,
    `    booking: {max_tasks: ${m.resources.services.booking.max_tasks}, vcpu_per_task: ${m.resources.services.booking.vcpu_per_task}, memory_gib_per_task: ${m.resources.services.booking.memory_gib_per_task}}`,
    `    worker: {max_tasks: ${m.resources.services.worker.max_tasks}, vcpu_per_task: ${m.resources.services.worker.vcpu_per_task}, memory_gib_per_task: ${m.resources.services.worker.memory_gib_per_task}}`,
    `  database_class: ${yamlString(m.resources.database_class)}`,
    `  cache_class: ${m.resources.cache_class}`,
    'cost:',
    `  estimated_hourly_usd: ${yamlString(m.cost.estimated_hourly_usd)}`,
    `  maximum_session_hours: ${yamlString(m.cost.maximum_session_hours)}`,
    `  expires_at: ${yamlString(m.cost.expires_at)}`,
    'failure_injection:',
    `  enabled: ${m.failure_injection.enabled}`,
    `  type: ${m.failure_injection.type}`,
    'validity_gates:',
    `  fixture_checksum_passed: ${m.validity_gates.fixture_checksum_passed}`,
    `  health_passed: ${m.validity_gates.health_passed}`,
    `  queue_empty_passed: ${m.validity_gates.queue_empty_passed}`,
    `  generator_preflight_passed: ${m.validity_gates.generator_preflight_passed}`,
    'artifacts:',
    `  prefix: ${yamlString(m.artifacts.prefix)}`,
    '',
  ];
  return lines.join('\n');
}

function gitHeadSha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (result.status !== 0) return 'TO_SET';
  return result.stdout.trim() || 'TO_SET';
}

/**
 * @param {object} input
 */
export function buildRunManifest(input) {
  const {
    runId,
    pairId,
    pairOrder,
    architecture,
    sessionName,
    owner = 'railflux-operator',
    applicationRegion = 'ap-south-1',
    requestSeed,
    randomizationSeed,
    wafMode = 'off',
    cacheCondition = 'none',
    loadLevel = 'L80',
    inventoryProfile = 'contention',
    durationSeconds = 180,
    cohortMix = { legitimate: 0.8, bot_like: 0.2 },
    fixtureId = 'railflux-tatkal-v1',
    fixtureSha256 = 'TO_SET',
    applicationGitSha = 'TO_SET',
    infrastructureGitSha = 'TO_SET',
    imageDigest = 'TO_SET',
    artifactsPrefix = 'TO_SET',
    resources = {},
    cost = {},
  } = input;

  const waf = wafMode === 'on' ? 'on' : 'off';
  const cache =
    cacheCondition === 'cold' || cacheCondition === 'warm' ? cacheCondition : 'none';

  return {
    schema_version: '1.0',
    run_id: runId,
    deployment: {
      session_name: sessionName,
      owner,
      application_region: applicationRegion,
    },
    pair_id: pairId,
    pair_order: pairOrder,
    architecture,
    versions: {
      application_git_sha: applicationGitSha,
      infrastructure_git_sha: infrastructureGitSha,
      image_digest: imageDigest,
    },
    fixture: {
      id: fixtureId,
      sha256: fixtureSha256,
      request_seed: requestSeed ?? randomizationSeed,
    },
    experiment: {
      inventory_profile: inventoryProfile,
      cache_condition: cache,
      load_level: loadLevel,
      waf_mode: waf,
      autoscaling: { enabled: false, policy_id: 'none' },
      cohort_mix: cohortMix,
      duration_seconds: durationSeconds,
    },
    resources: {
      request_serving_vcpu_max_total: resources.request_serving_vcpu_max_total ?? 'TO_SET',
      request_serving_memory_gib_max_total:
        resources.request_serving_memory_gib_max_total ?? 'TO_SET',
      services: {
        baseline: resources.services?.baseline ?? {
          max_tasks: 0,
          vcpu_per_task: 0,
          memory_gib_per_task: 0,
        },
        read: resources.services?.read ?? {
          max_tasks: 0,
          vcpu_per_task: 0,
          memory_gib_per_task: 0,
        },
        booking: resources.services?.booking ?? {
          max_tasks: 0,
          vcpu_per_task: 0,
          memory_gib_per_task: 0,
        },
        worker: resources.services?.worker ?? {
          max_tasks: 0,
          vcpu_per_task: 0,
          memory_gib_per_task: 0,
        },
      },
      database_class: resources.database_class ?? 'TO_SET',
      cache_class: resources.cache_class ?? 'none',
    },
    cost: {
      estimated_hourly_usd: cost.estimated_hourly_usd ?? 'TO_SET',
      maximum_session_hours: cost.maximum_session_hours ?? 'TO_SET',
      expires_at: cost.expires_at ?? 'TO_SET',
    },
    failure_injection: { enabled: false, type: 'none' },
    validity_gates: {
      fixture_checksum_passed: false,
      health_passed: false,
      queue_empty_passed: false,
      generator_preflight_passed: false,
    },
    artifacts: { prefix: artifactsPrefix },
    randomization_seed: randomizationSeed,
  };
}

/**
 * @param {object} options
 */
export function generatePairManifests(options) {
  const pairOrder = pairOrderFromSeed(options.randomizationSeed);
  const sequence = architecturesForPairOrder(pairOrder);
  const requestSeed = options.requestSeed ?? options.randomizationSeed;

  return sequence.map((architecture, index) => {
    const runId =
      options.runIdPattern?.(architecture, index) ??
      `run-${options.pairId}-${architecture}`;
    return buildRunManifest({
      ...options,
      pairOrder,
      architecture,
      runId,
      requestSeed,
    });
  });
}

export function assertTemplateStructure(manifestObject) {
  const keys = Object.keys(manifestObject).filter((k) => k !== 'randomization_seed');
  for (const key of RUN_MANIFEST_TEMPLATE_KEYS) {
    if (!keys.includes(key)) {
      throw new Error(`Generated manifest missing template key: ${key}`);
    }
  }
}

function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  const positional = [];
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-/g, '_');
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

function usage() {
  console.log(`Usage: generate-run-manifest.mjs --pair-id ID --randomization-seed N [options]

Options:
  --session-name NAME       deployment.session_name (required)
  --request-seed N          fixture.request_seed (default: randomization-seed)
  --waf-mode off|on         experiment.waf_mode (default: off)
  --cache-condition none|cold|warm
  --load-level L80          experiment.load_level
  --inventory-profile NAME  experiment.inventory_profile
  --duration-seconds N
  --cohort-legitimate 0.8 --cohort-bot 0.2
  --output-dir PATH         Write YAML files (default: stdout JSON plan)
  --fill-git-shas           Set application/infrastructure git sha from HEAD
  --fixture-sha256 HEX      fixture.sha256 (default TO_SET)
`);
}

function main() {
  const { flags } = parseArgs(process.argv);
  if (flags.help) {
    usage();
    process.exit(0);
  }

  const pairId = String(flags.pair_id || '');
  const randomizationSeed = Number(flags.randomization_seed);
  const sessionName = String(flags.session_name || '');

  if (!pairId || !Number.isInteger(randomizationSeed) || randomizationSeed < 0 || !sessionName) {
    usage();
    process.exit(1);
  }

  let applicationGitSha = 'TO_SET';
  let infrastructureGitSha = 'TO_SET';
  if (flags.fill_git_shas) {
    const sha = gitHeadSha();
    applicationGitSha = sha;
    infrastructureGitSha = sha;
  }

  const manifests = generatePairManifests({
    pairId,
    randomizationSeed,
    sessionName,
    requestSeed: flags.request_seed ? Number(flags.request_seed) : undefined,
    wafMode: flags.waf_mode ? String(flags.waf_mode) : 'off',
    cacheCondition: flags.cache_condition ? String(flags.cache_condition) : 'none',
    loadLevel: flags.load_level ? String(flags.load_level) : 'L80',
    inventoryProfile: flags.inventory_profile ? String(flags.inventory_profile) : 'contention',
    durationSeconds: flags.duration_seconds ? Number(flags.duration_seconds) : 180,
    cohortMix: {
      legitimate: flags.cohort_legitimate ? Number(flags.cohort_legitimate) : 0.8,
      bot_like: flags.cohort_bot ? Number(flags.cohort_bot) : 0.2,
    },
    fixtureSha256: flags.fixture_sha256 ? String(flags.fixture_sha256) : 'TO_SET',
    applicationGitSha,
    infrastructureGitSha,
  });

  for (const manifest of manifests) {
    assertTemplateStructure(manifest);
  }

  const pairOrder = manifests[0]?.pair_order;
  const plan = {
    event: 'pair_manifests_generated',
    pair_id: pairId,
    randomization_seed: randomizationSeed,
    pair_order: pairOrder,
    template: path.relative(REPO_ROOT, TEMPLATE_PATH),
    manifests: manifests.map((m) => ({
      run_id: m.run_id,
      architecture: m.architecture,
      waf_mode: m.experiment.waf_mode,
      cache_condition: m.experiment.cache_condition,
      execution_order: m.architecture,
    })),
  };

  const outputDir = flags.output_dir ? path.resolve(String(flags.output_dir)) : null;
  if (outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    const written = [];
    for (const manifest of manifests) {
      const filePath = path.join(outputDir, `${manifest.run_id}.yaml`);
      fs.writeFileSync(filePath, renderRunManifestYaml(manifest), 'utf8');
      written.push(filePath);
    }
    plan.written = written.map((p) => path.relative(REPO_ROOT, p));
  }

  console.log(JSON.stringify(plan, null, 2));
}

const isCliMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCliMain) {
  main();
}
