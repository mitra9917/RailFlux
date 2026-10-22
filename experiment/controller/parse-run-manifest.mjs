#!/usr/bin/env node
/**
 * Run manifest fields for experiment controller (M6 #58).
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseLoadManifestText } from '../../load-tests/scripts/load-manifest.mjs';

const PLACEHOLDER = /^(TO_SET|TO_BE_GENERATED)$/i;

function pick(text, pattern) {
  const m = text.match(pattern);
  return m?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
}

export function parseControllerManifestText(text) {
  const base = parseLoadManifestText(text);
  const pairId = pick(text, /^pair_id:\s*(\S+)/m);
  const pairOrder = pick(text, /^pair_order:\s*(\S+)/m);
  const cacheCondition = pick(text, /^  cache_condition:\s*(\S+)/m) || 'none';
  const fixtureSha256 = pick(text, /^  sha256:\s*(\S+)/m);
  const legitimate = Number(pick(text, /^    legitimate:\s*([\d.]+)/m) || 1);
  const botLike = Number(pick(text, /^    bot_like:\s*([\d.]+)/m) || 0);
  const requestSeed = Number(base.requestSeed || pick(text, /^  request_seed:\s*(\d+)/m) || 0);

  return {
    ...base,
    pairId,
    pairOrder: pairOrder === 'BA' ? 'BA' : 'AB',
    cacheCondition,
    fixtureSha256,
    requestSeed,
    cohortMix: { legitimate, bot_like: botLike },
  };
}

export function parseControllerManifest(manifestPath) {
  const abs = path.resolve(manifestPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Manifest not found: ${abs}`);
  }
  return parseControllerManifestText(fs.readFileSync(abs, 'utf8'));
}

/**
 * @param {ReturnType<typeof parseControllerManifestText>} parsed
 * @param {{ now?: () => number }} [options]
 */
export function resolveRunId(parsed, options = {}) {
  const now = options.now ?? Date.now;
  const candidate = String(parsed.runId || '').trim();
  if (candidate && !PLACEHOLDER.test(candidate)) {
    return candidate;
  }
  const iso = new Date(now()).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `run-${iso}`;
}

function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    console.error('Usage: parse-run-manifest.mjs <manifest.yaml>');
    process.exit(1);
  }
  try {
    const parsed = parseControllerManifest(manifestPath);
    const runId = resolveRunId(parsed);
    console.log(
      JSON.stringify(
        { ...parsed, manifestPath: path.resolve(manifestPath), runId },
        null,
        2,
      ),
    );
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
