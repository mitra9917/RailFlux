#!/usr/bin/env node
/**
 * Paired bootstrap analysis for principal campaigns (M7 #66).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { holmAdjust } from './holm.mjs';
import {
  collectPrincipalPairs,
  metricPairsFromRecords,
} from './load-pairs.mjs';
import {
  pairedBootstrapMeanLogRatio,
  pairedBootstrapPValueGreaterThan,
  pairedBootstrapPValueLessThan,
  pairedLogRatios,
} from './paired-bootstrap.mjs';
import { loadHypothesesForAnalysis } from './read-hypotheses-analysis.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_RUNS = path.join(REPO_ROOT, 'experiment/runs');
const DEFAULT_OUT = path.join(REPO_ROOT, 'experiment/analysis/output');

/**
 * @param {object} options
 */
export function analyzePairedCampaign(options) {
  const {
    campaign,
    pairRecords,
    hypothesesDoc,
    bootstrapIterations = 10_000,
    bootstrapSeed = 66,
    filterLoadLevel = null,
    filterCellId = null,
  } = options;

  let records = pairRecords;
  if (filterLoadLevel) {
    records = records.filter((r) => r.load_level === filterLoadLevel);
  }
  if (filterCellId) {
    records = records.filter((r) => r.cell_id === filterCellId);
  }

  const validCount = records.filter((r) => r.status === 'valid').length;
  const hypothesesPath = options.hypothesesPath;

  /** @type {object[]} */
  const metrics = [];
  /** @type {object[]} */
  const secondaryTests = [];

  for (const hyp of hypothesesDoc.hypotheses) {
    if (!hyp.metric || hyp.design) {
      metrics.push({
        hypothesis_id: hyp.id,
        metric: hyp.metric,
        status: 'skipped',
        reason: hyp.design ? 'non_paired_design' : 'no_metric',
      });
      continue;
    }

    const valuePairs = metricPairsFromRecords(records, hyp.metric, hypothesesPath);
    const logRatios = pairedLogRatios(valuePairs);
    const bootstrap = pairedBootstrapMeanLogRatio(logRatios, {
      iterations: bootstrapIterations,
      seed: bootstrapSeed,
    });

    /** @type {object} */
    let test = null;
    if (hyp.minimum_effect_ratio != null) {
      test = pairedBootstrapPValueGreaterThan(logRatios, hyp.minimum_effect_ratio, {
        iterations: bootstrapIterations,
        seed: bootstrapSeed,
      });
    } else if (hyp.maximum_effect_ratio != null) {
      test = pairedBootstrapPValueLessThan(logRatios, hyp.maximum_effect_ratio, {
        iterations: bootstrapIterations,
        seed: bootstrapSeed,
      });
    }

    const entry = {
      hypothesis_id: hyp.id,
      primary: hyp.primary === true,
      metric: hyp.metric,
      n_pairs: bootstrap.n_pairs,
      pairs: valuePairs,
      effect: hypothesesDoc.analysis.effect,
      interval: hypothesesDoc.analysis.interval,
      log_ratio_mean: bootstrap.log_ratio_mean,
      log_ratio_median: bootstrap.log_ratio_median,
      geometric_mean_ratio: bootstrap.geometric_mean_ratio,
      median_ratio: bootstrap.median_ratio,
      ci_95_log: bootstrap.ci_95_log,
      ci_95_ratio: bootstrap.ci_95_ratio,
      bootstrap_iterations: bootstrap.bootstrap_iterations,
      null_ratio: test?.null_ratio ?? null,
      p_value: test?.p_value ?? null,
    };

    if (hyp.minimum_effect_ratio != null) {
      entry.minimum_effect_ratio = hyp.minimum_effect_ratio;
      entry.meets_minimum =
        bootstrap.ci_95_ratio?.[0] != null && bootstrap.ci_95_ratio[0] >= hyp.minimum_effect_ratio;
    }
    if (hyp.maximum_effect_ratio != null) {
      entry.maximum_effect_ratio = hyp.maximum_effect_ratio;
      entry.meets_maximum =
        bootstrap.ci_95_ratio?.[1] != null && bootstrap.ci_95_ratio[1] <= hyp.maximum_effect_ratio;
    }

    metrics.push(entry);
    if (hyp.secondary && test?.p_value != null) {
      secondaryTests.push({ id: hyp.id, p_value: test.p_value });
    }
  }

  const holm = holmAdjust(secondaryTests);

  const correctnessH3 = records
    .filter((r) => r.status === 'valid')
    .every(
      (r) =>
        (r.baseline_result.booking?.oversells ?? 0) === 0 &&
        (r.baseline_result.booking?.duplicate_charges ?? 0) === 0 &&
        (r.optimized_result.booking?.oversells ?? 0) === 0 &&
        (r.optimized_result.booking?.duplicate_charges ?? 0) === 0,
    );

  return {
    schema_version: '1.0',
    event: 'paired_bootstrap_analysis',
    campaign_id: campaign?.plan?.campaign_id ?? null,
    analysis: hypothesesDoc.analysis,
    pair_summary: {
      total: records.length,
      valid: validCount,
      missing_results: records.filter((r) => r.status === 'missing_results').length,
      invalid_run: records.filter((r) => r.status === 'invalid_run').length,
    },
    metrics,
    holm_secondary: holm,
    correctness: {
      H3_oversell_and_duplicate_zero: {
        ok: correctnessH3,
        valid_pairs_checked: validCount,
      },
    },
    generated_at: new Date().toISOString(),
  };
}

function parseArgs(argv) {
  /** @type {Record<string, string | number | boolean>} */
  const out = {
    campaignPath: '',
    runsDir: DEFAULT_RUNS,
    outPath: '',
    hypothesesPath: '',
    loadLevel: '',
    cellId: '',
    bootstrapIterations: 10_000,
    bootstrapSeed: 66,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--campaign' && argv[i + 1]) out.campaignPath = argv[++i];
    else if (a === '--runs' && argv[i + 1]) out.runsDir = argv[++i];
    else if (a === '--out' && argv[i + 1]) out.outPath = argv[++i];
    else if (a === '--hypotheses' && argv[i + 1]) out.hypothesesPath = argv[++i];
    else if (a === '--load-level' && argv[i + 1]) out.loadLevel = argv[++i];
    else if (a === '--cell' && argv[i + 1]) out.cellId = argv[++i];
    else if (a === '--bootstrap-iterations' && argv[i + 1]) {
      out.bootstrapIterations = Number(argv[++i]);
    } else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.campaignPath) {
    console.log(`Usage: analyze-paired-campaign.mjs --campaign PATH [--runs DIR] [--out PATH]
  [--hypotheses PATH] [--load-level L80] [--cell C1-L80-legit] [--dry-run]`);
    process.exit(args.help ? 0 : 1);
  }

  const campaignPath = path.resolve(args.campaignPath);
  const campaign = JSON.parse(fs.readFileSync(campaignPath, 'utf8'));
  const pairRecords = collectPrincipalPairs(campaign, path.resolve(args.runsDir));
  const hypothesesDoc = loadHypothesesForAnalysis(
    args.hypothesesPath ? path.resolve(args.hypothesesPath) : undefined,
  );

  const report = analyzePairedCampaign({
    campaign,
    pairRecords,
    hypothesesDoc,
    hypothesesPath: args.hypothesesPath || undefined,
    bootstrapIterations: args.bootstrapIterations,
    bootstrapSeed: args.bootstrapSeed,
    filterLoadLevel: args.loadLevel || null,
    filterCellId: args.cellId || null,
  });

  const outPath =
    args.outPath ||
    path.join(
      DEFAULT_OUT,
      `${report.campaign_id || path.basename(campaignPath, '.json')}-analysis.json`,
    );

  if (!args.dryRun) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  console.log(JSON.stringify({ ...report, output_path: args.dryRun ? null : outPath }));
  process.exit(0);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main();
}
