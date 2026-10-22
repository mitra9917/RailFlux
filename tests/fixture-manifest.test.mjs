import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { TC001_USER_ID } from './helpers/tc001-fixture.mjs';
import { verifyFixtureManifest } from '../database/scripts/fixture-checksum.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'experiment/fixtures/manifest.yaml');

test('experiment fixture manifest checksums are pinned and valid', () => {
  const result = verifyFixtureManifest(manifestPath);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.equal(result.fixtureId, 'railflux-tatkal-v1');
});

test('fixture seed includes pinned TC-001 demo user for local simulator', () => {
  const generator = path.join(repoRoot, 'database/scripts/generate-seed-sql.mjs');
  const result = spawnSync(process.execPath, [generator], {
    cwd: repoRoot,
    env: { ...process.env, FIXTURE_MANIFEST: manifestPath },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, new RegExp(`INSERT INTO users \\(id, cohort\\) VALUES \\('${TC001_USER_ID}'`));
});
