#!/usr/bin/env node
/**
 * Build static results dashboard + cost parity (M7 #67).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectPrincipalPairs } from '../analysis/load-pairs.mjs';
import { buildDashboardData } from './build-dashboard-data.mjs';
import { renderDashboardHtml } from './render-dashboard-html.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_RUNS = path.join(REPO_ROOT, 'experiment/runs');
const DEFAULT_OUT = path.join(REPO_ROOT, 'experiment/dashboard/output');

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const out = {
    campaignPath: '',
    runsDir: DEFAULT_RUNS,
    analysisPath: '',
    outDir: DEFAULT_OUT,
    hypothesesPath: '',
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--campaign' && argv[i + 1]) out.campaignPath = argv[++i];
    else if (a === '--runs' && argv[i + 1]) out.runsDir = argv[++i];
    else if (a === '--analysis' && argv[i + 1]) out.analysisPath = argv[++i];
    else if (a === '--out-dir' && argv[i + 1]) out.outDir = argv[++i];
    else if (a === '--hypotheses' && argv[i + 1]) out.hypothesesPath = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.campaignPath) {
    console.log(`Usage: generate-results-dashboard.mjs --campaign PATH [--analysis PATH] [--runs DIR] [--out-dir DIR] [--dry-run]`);
    process.exit(args.help ? 0 : 1);
  }

  const campaign = readJson(path.resolve(args.campaignPath));
  const pairRecords = collectPrincipalPairs(campaign, path.resolve(args.runsDir));
  let analysisReport = null;
  if (args.analysisPath && fs.existsSync(path.resolve(args.analysisPath))) {
    analysisReport = readJson(path.resolve(args.analysisPath));
    analysisReport.path = path.resolve(args.analysisPath);
  }

  const data = buildDashboardData({
    campaign,
    pairRecords,
    analysisReport,
    hypothesesPath: args.hypothesesPath || undefined,
  });

  const baseName = data.campaign_id || 'campaign';
  const jsonPath = path.join(path.resolve(args.outDir), `${baseName}-dashboard.json`);
  const htmlPath = path.join(path.resolve(args.outDir), `${baseName}-dashboard.html`);

  if (!args.dryRun) {
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    fs.writeFileSync(htmlPath, renderDashboardHtml(data), 'utf8');
  }

  console.log(
    JSON.stringify({
      event: 'results_dashboard_generated',
      campaign_id: data.campaign_id,
      json_path: args.dryRun ? null : jsonPath,
      html_path: args.dryRun ? null : htmlPath,
      valid_pairs: data.pair_summary.valid,
    }),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main();
}
