import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyFixtureManifest } from '../database/scripts/fixture-checksum.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'experiment/fixtures/manifest.yaml');

test('experiment fixture manifest checksums are pinned and valid', () => {
  const result = verifyFixtureManifest(manifestPath);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.equal(result.fixtureId, 'railflux-tatkal-v1');
});
