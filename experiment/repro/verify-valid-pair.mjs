#!/usr/bin/env node
/**
 * Verify a principal campaign export has at least one fully valid AB/BA pair (M7 #69).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {object} campaign
 * @param {{ minValidPairs?: number }} [options]
 */
export function summarizeValidPairs(campaign, options = {}) {
  const minValidPairs = options.minValidPairs ?? 1;
  /** @type {object[]} */
  const outcomes = campaign.outcomes ?? [];
  /** @type {Map<string, object[]>} */
  const byPair = new Map();
  for (const o of outcomes) {
    const key = o.pair_id;
    if (!key) continue;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key).push(o);
  }

  /** @type {string[]} */
  const validPairIds = [];
  /** @type {string[]} */
  const incompletePairIds = [];

  for (const [pairId, legs] of byPair) {
    if (legs.length < 2) {
      incompletePairIds.push(pairId);
      continue;
    }
    if (legs.every((leg) => leg.valid)) validPairIds.push(pairId);
  }

  return {
    pairs_total: byPair.size,
    valid_pairs: validPairIds.length,
    valid_pair_ids: validPairIds,
    incomplete_pair_ids: incompletePairIds,
    runs_valid: outcomes.filter((o) => o.valid).length,
    runs_total: outcomes.length,
    satisfied: validPairIds.length >= minValidPairs,
    min_valid_pairs: minValidPairs,
  };
}

function usage() {
  console.error(`Usage: verify-valid-pair.mjs <campaign.json> [--min-valid-pairs N]`);
}

function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv.includes('-h') || argv.includes('--help')) {
    usage();
    process.exit(argv.length ? 0 : 1);
  }

  let minValidPairs = 1;
  /** @type {string | null} */
  let campaignPath = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--min-valid-pairs' && argv[i + 1]) {
      minValidPairs = Number(argv[++i]);
    } else if (!a.startsWith('-')) {
      campaignPath = a;
    }
  }

  if (!campaignPath) {
    usage();
    process.exit(1);
  }

  const resolved = path.isAbsolute(campaignPath)
    ? campaignPath
    : path.resolve(process.cwd(), campaignPath);
  const campaign = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const summary = summarizeValidPairs(campaign, { minValidPairs });
  console.log(JSON.stringify({ event: 'repro_valid_pair_check', campaign_path: resolved, ...summary }));

  if (!summary.satisfied) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
