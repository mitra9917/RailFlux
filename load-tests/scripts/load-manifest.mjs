#!/usr/bin/env node
/**
 * Run manifest fields for k6 load tests (M6 #57).
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseRunManifestText } from '../../infrastructure/scripts/aws-run-manifest.mjs';

function pick(text, pattern) {
  const m = text.match(pattern);
  return m?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
}

export function parseLoadManifestText(text) {
  const base = parseRunManifestText(text);
  return {
    ...base,
    inventoryProfile: pick(text, /^  inventory_profile:\s*(\S+)/m) || 'contention',
    loadLevel: pick(text, /^  load_level:\s*(\S+)/m) || 'L80',
    durationSeconds: Number(pick(text, /^  duration_seconds:\s*(\d+)/m) || 180),
    requestSeed: pick(text, /^  request_seed:\s*(\S+)/m),
    fixtureId: pick(text, /^fixture:\s*\n  id:\s*(\S+)/m),
  };
}

export function parseLoadManifest(manifestPath) {
  const abs = path.resolve(manifestPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Manifest not found: ${abs}`);
  }
  return parseLoadManifestText(fs.readFileSync(abs, 'utf8'));
}

/**
 * Map manifest load_level (e.g. L80) to open-model arrival rate (RPS).
 * @param {string} loadLevel
 * @param {number} fallback
 */
export function loadLevelToArrivalRate(loadLevel, fallback = 8) {
  const match = /^L(\d+)$/i.exec(String(loadLevel || '').trim());
  if (!match) return fallback;
  return Math.max(1, Math.min(50, Math.round(Number(match[1]) / 10)));
}

/**
 * @param {string} manifestPath
 */
export function resolveLoadPlan(manifestPath) {
  const parsed = parseLoadManifest(manifestPath);
  const rate = loadLevelToArrivalRate(parsed.loadLevel);
  const duration = `${parsed.durationSeconds}s`;
  const runId = parsed.runId && !/^(TO_SET|TO_BE_GENERATED)$/i.test(parsed.runId)
    ? parsed.runId
    : `load-${Date.now()}`;
  return {
    manifestPath: path.resolve(manifestPath),
    runId,
    rate,
    duration,
    durationSeconds: parsed.durationSeconds,
    inventoryProfile: parsed.inventoryProfile,
    loadLevel: parsed.loadLevel,
    architecture: parsed.architecture,
    runPt006: parsed.inventoryProfile === 'contention',
  };
}

function main() {
  const manifestPath = process.argv[2];
  const mode = process.argv[3] || 'json';
  if (!manifestPath) {
    console.error('Usage: load-manifest.mjs <manifest.yaml> [json|shell]');
    process.exit(1);
  }
  try {
    const plan = resolveLoadPlan(manifestPath);
    if (mode === 'shell') {
      console.log(`LOAD_MANIFEST=${plan.manifestPath}`);
      console.log(`LOAD_RUN_ID=${plan.runId}`);
      console.log(`LOAD_RATE=${plan.rate}`);
      console.log(`LOAD_DURATION=${plan.duration}`);
      console.log(`LOAD_INVENTORY_PROFILE=${plan.inventoryProfile}`);
      console.log(`LOAD_RUN_PT006=${plan.runPt006 ? 1 : 0}`);
      console.log(`LOAD_LEVEL=${plan.loadLevel}`);
      process.exit(0);
    }
    console.log(JSON.stringify(plan, null, 2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
