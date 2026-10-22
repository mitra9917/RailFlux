#!/usr/bin/env node
/**
 * Write controller input state JSON for finalize-run.mjs (M6 #58).
 */
import fs from 'node:fs';
import path from 'node:path';

function parseProtocolLines(raw) {
  /** @type {Record<string, { status: string, detail: string | null }>} */
  const steps = {};
  for (const line of String(raw || '').split('\n')) {
    if (!line.trim()) continue;
    const [key, status, detail] = line.split('|');
    if (!key || !status) continue;
    steps[key] = { status, detail: detail || null };
  }
  return steps;
}

function readJsonOrNull(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return { parse_error: true };
  }
}

function main() {
  const [
    outPath,
    planJson,
    runId,
    manifestPath,
    validStr,
    invalidReason,
    fixtureJson,
    correctnessJson,
    correctnessPassed,
  ] = process.argv.slice(2);
  const k6Paths = String(process.env.K6_ARTIFACT_LIST || '')
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);

  if (!outPath || !planJson || !runId) {
    console.error(
      'Usage: write-run-input.mjs OUT.json PLAN_JSON RUN_ID MANIFEST VALID REASON FIXTURE_JSON CORRECTNESS_JSON CORRECTNESS_PASSED [k6 artifacts...]',
    );
    process.exit(1);
  }

  const manifest = JSON.parse(planJson);
  const valid = validStr === '1';

  const k6Artifacts = k6Paths.filter(Boolean).map((p) => {
    const abs = path.resolve(p);
    let index = null;
    if (fs.existsSync(abs)) {
      try {
        index = JSON.parse(fs.readFileSync(abs, 'utf8'));
      } catch {
        index = null;
      }
    }
    return { path: abs, index };
  });

  let correctness = readJsonOrNull(correctnessJson);
  if (!correctness && (correctnessPassed === 'true' || correctnessPassed === 'false')) {
    correctness = { passed: correctnessPassed === 'true' };
  }

  const protocolSteps = parseProtocolLines(process.env.PROTOCOL_LINES);
  protocolSteps['13_export_artifacts'] = { status: 'pending', detail: null };
  protocolSteps['14_mark_validity'] = { status: 'pending', detail: null };

  const payload = {
    runId,
    manifestPath,
    manifest,
    fixtureVerification: readJsonOrNull(fixtureJson),
    generatorPreflight: readJsonOrNull(process.env.GENERATOR_PREFLIGHT_JSON),
    protocolSteps,
    k6Artifacts,
    correctness,
    valid,
    invalidReason: valid ? null : invalidReason || 'unknown',
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

main();
