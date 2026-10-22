#!/usr/bin/env node
/**
 * Optional live M7 gate — campaign scope + sign-off (M7 #70).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateM7CampaignAcceptance } from './evaluate-m7-campaign.mjs';
import { evaluateM7SignoffFile } from './evaluate-m7-signoff.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_SIGNOFF = path.join(REPO_ROOT, 'docs/milestones/M7-gate-signoff.md');
const DEFAULT_AMENDMENT = path.join(REPO_ROOT, 'docs/milestones/M7-budget-amendment.md');

function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const out = {
    campaignPath: '',
    signoffPath: DEFAULT_SIGNOFF,
    budgetAmendmentPath: DEFAULT_AMENDMENT,
    skipSignoff: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--campaign' && argv[i + 1]) out.campaignPath = argv[++i];
    else if (a === '--signoff' && argv[i + 1]) out.signoffPath = argv[++i];
    else if (a === '--budget-amendment' && argv[i + 1]) out.budgetAmendmentPath = argv[++i];
    else if (a === '--skip-signoff') out.skipSignoff = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.campaignPath) {
    console.error(
      'Usage: verify-m7-acceptance.mjs --campaign PATH [--signoff PATH] [--budget-amendment PATH] [--skip-signoff]',
    );
    process.exit(args.help ? 0 : 1);
  }

  const campaignPath = path.resolve(args.campaignPath);
  const campaign = JSON.parse(fs.readFileSync(campaignPath, 'utf8'));
  const campaignEval = evaluateM7CampaignAcceptance(campaign, {
    budgetAmendmentPath: args.budgetAmendmentPath,
  });
  const signoffEval = args.skipSignoff ? { satisfied: true, skipped: true } : evaluateM7SignoffFile(args.signoffPath);

  const satisfied = campaignEval.satisfied && signoffEval.satisfied;
  console.log(
    JSON.stringify({
      event: 'm7_acceptance_check',
      campaign_path: campaignPath,
      satisfied,
      campaign: campaignEval,
      signoff: signoffEval,
    }),
  );
  process.exit(satisfied ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
