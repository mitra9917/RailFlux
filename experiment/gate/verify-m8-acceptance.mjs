#!/usr/bin/env node
/**
 * Optional live M8 gate — sign-off checklist (M8 #75).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateM8SignoffFile } from './evaluate-m8-signoff.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_SIGNOFF = path.join(REPO_ROOT, 'docs/milestones/M8-gate-signoff.md');

function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const out = { signoffPath: DEFAULT_SIGNOFF };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--signoff' && argv[i + 1]) out.signoffPath = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.error('Usage: verify-m8-acceptance.mjs [--signoff PATH]');
    process.exit(0);
  }

  const signoffEval = evaluateM8SignoffFile(args.signoffPath);
  const satisfied = signoffEval.satisfied;
  console.log(
    JSON.stringify({
      event: 'm8_acceptance_check',
      satisfied,
      signoff: signoffEval,
    }),
  );
  process.exit(satisfied ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
