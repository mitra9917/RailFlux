import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  parseRunManifestText,
  validateRunManifestPreflight,
} from '../infrastructure/scripts/aws-run-manifest.mjs';

const root = join(import.meta.dirname, '..');

const validManifest = `
run_id: run-test-001
architecture: optimized
deployment:
  session_name: lab-test
  owner: operator1
  application_region: ap-south-1
experiment:
  waf_mode: "off"
cost:
  estimated_hourly_usd: "2.50"
  maximum_session_hours: "4"
  expires_at: 2026-12-31T23:59:59Z
`;

test('M5 #52 manifest preflight accepts filled run manifest', () => {
  const parsed = parseRunManifestText(validManifest);
  assert.equal(parsed.runId, 'run-test-001');
  assert.equal(parsed.sessionName, 'lab-test');
  assert.equal(parsed.architecture, 'optimized');
  const dir = mkdtempSync(join(tmpdir(), 'railflux-manifest-'));
  const manifestPath = join(dir, 'run.yaml');
  writeFileSync(manifestPath, validManifest);
  const result = validateRunManifestPreflight(manifestPath);
  assert.equal(result.ok, true);
  assert.equal(result.config?.deploymentProfile, 'aws-optimized');
});

test('M5 #52 deploy session script documents dry-run default', () => {
  const session = readFileSync(
    join(root, 'infrastructure/scripts/aws-deploy-session.sh'),
    'utf8',
  );
  assert.match(session, /--dry-run/);
  assert.match(session, /--execute/);
  assert.match(session, /aws-deploy-preflight/);
});
