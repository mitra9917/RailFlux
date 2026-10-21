#!/usr/bin/env node
/**
 * Parse experiment run manifest YAML (subset) for AWS deploy preflight (M5 #52).
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PLACEHOLDER = /^(TO_SET|TO_BE_GENERATED)$/i;

function pick(text, pattern) {
  const m = text.match(pattern);
  return m?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
}

export function parseRunManifestText(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  return {
    runId: pick(normalized, /^run_id:\s*(\S+)/m),
    architecture: pick(normalized, /^architecture:\s*(\S+)/m),
    wafMode: pick(normalized, /^  waf_mode:\s*"?([^"\n#]+)"?/m),
    expiresAt: pick(normalized, /^  expires_at:\s*(\S+)/m),
    estimatedHourlyUsd: pick(normalized, /^  estimated_hourly_usd:\s*(\S+)/m),
    maximumSessionHours: pick(normalized, /^  maximum_session_hours:\s*(\S+)/m),
    sessionName: pick(normalized, /^  session_name:\s*(\S+)/m),
    owner: pick(normalized, /^  owner:\s*(\S+)/m),
    applicationRegion:
      pick(normalized, /^  application_region:\s*(\S+)/m) || 'ap-south-1',
  };
}

export function parseRunManifest(manifestPath) {
  const abs = path.resolve(manifestPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Manifest not found: ${abs}`);
  }
  return parseRunManifestText(fs.readFileSync(abs, 'utf8'));
}

export function validateRunManifestPreflight(manifestPath, options = {}) {
  const { requireExecuteEnv = false } = options;
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  let parsed;
  try {
    parsed = parseRunManifest(manifestPath);
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : String(err)], warnings, config: null };
  }

  const {
    runId,
    architecture,
    wafMode,
    expiresAt,
    estimatedHourlyUsd,
    maximumSessionHours,
    sessionName,
    owner,
    applicationRegion,
  } = parsed;

  if (!runId || PLACEHOLDER.test(runId)) errors.push('run_id must be set (not TO_SET)');
  if (!architecture || !['baseline', 'optimized'].includes(architecture)) {
    errors.push('architecture must be baseline or optimized');
  }
  if (!expiresAt || PLACEHOLDER.test(expiresAt)) {
    errors.push('cost.expires_at must be set (ISO8601 teardown deadline)');
  } else if (Number.isNaN(Date.parse(expiresAt))) {
    errors.push('cost.expires_at must be valid ISO8601');
  }
  if (!estimatedHourlyUsd || PLACEHOLDER.test(estimatedHourlyUsd)) {
    warnings.push('cost.estimated_hourly_usd is TO_SET — fill before paid deploy');
  }
  if (!maximumSessionHours || PLACEHOLDER.test(maximumSessionHours)) {
    warnings.push('cost.maximum_session_hours is TO_SET — fill before paid deploy');
  }
  if (wafMode && !['off', 'on'].includes(wafMode)) {
    errors.push('experiment.waf_mode must be off or on');
  }

  const session = sessionName && !PLACEHOLDER.test(sessionName) ? sessionName : '';
  if (!session) {
    errors.push('deployment.session_name must be set in manifest (see run-manifest.template.yaml)');
  } else if (!/^[a-z0-9][a-z0-9-]*$/.test(session)) {
    errors.push('deployment.session_name must match ^[a-z0-9][a-z0-9-]*$');
  }

  const deploymentProfile =
    architecture === 'optimized' ? 'aws-optimized' : 'aws-baseline';

  if (requireExecuteEnv) {
    for (const key of [
      'SYNTHETIC_JWT_SECRET',
      'ACM_CERTIFICATE_ARN',
      'ORIGIN_HEADER_VALUE',
    ]) {
      if (!process.env[key]?.trim()) {
        errors.push(`Missing env ${key} (required for --execute deploy)`);
      }
    }
    const imageKeys =
      architecture === 'optimized'
        ? [
            'CONTAINER_IMAGE_EDGE',
            'CONTAINER_IMAGE_READ',
            'CONTAINER_IMAGE_BOOKING',
            'CONTAINER_IMAGE_WORKER',
          ]
        : ['CONTAINER_IMAGE'];
    for (const key of imageKeys) {
      if (!process.env[key]?.trim()) {
        errors.push(`Missing env ${key} (container image URI for --execute)`);
      }
    }
  }

  const config = {
    manifestPath: path.resolve(manifestPath),
    runId: runId || '',
    session,
    owner: owner && !PLACEHOLDER.test(owner) ? owner : 'railflux',
    expiresAt: expiresAt || '',
    architecture: architecture || '',
    deploymentProfile,
    wafMode: wafMode || 'off',
    applicationRegion,
  };

  return { ok: errors.length === 0, errors, warnings, config };
}

function main() {
  const manifestPath = process.argv[2];
  const mode = process.argv[3] || 'check';
  if (!manifestPath) {
    console.error('Usage: aws-run-manifest.mjs <manifest.yaml> [check|shell|json]');
    process.exit(1);
  }
  const requireExecuteEnv = process.env.RAILFLUX_REQUIRE_EXECUTE_ENV === '1';
  const result = validateRunManifestPreflight(manifestPath, { requireExecuteEnv });
  if (mode === 'json') {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }
  if (mode === 'shell' && result.config) {
    const c = result.config;
    console.log(`RAILFLUX_MANIFEST=${c.manifestPath}`);
    console.log(`RAILFLUX_RUN_ID=${c.runId}`);
    console.log(`RAILFLUX_SESSION=${c.session}`);
    console.log(`RAILFLUX_OWNER=${c.owner}`);
    console.log(`RAILFLUX_EXPIRES_AT=${c.expiresAt}`);
    console.log(`RAILFLUX_DEPLOYMENT_PROFILE=${c.deploymentProfile}`);
    console.log(`RAILFLUX_WAF_MODE=${c.wafMode}`);
    console.log(`RAILFLUX_APP_REGION=${c.applicationRegion}`);
    process.exit(result.ok ? 0 : 1);
  }
  for (const w of result.warnings) console.warn(`WARN: ${w}`);
  for (const e of result.errors) console.error(`ERROR: ${e}`);
  if (result.ok) {
    console.log(`Manifest preflight OK: run_id=${result.config?.runId} session=${result.config?.session}`);
  }
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
