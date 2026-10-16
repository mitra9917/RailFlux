#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, verifyFixtureManifest } from './fixture-checksum.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const manifestPath = process.env.FIXTURE_MANIFEST
  ? path.resolve(process.env.FIXTURE_MANIFEST)
  : path.join(REPO_ROOT, 'experiment/fixtures/manifest.yaml');

try {
  const result = verifyFixtureManifest(manifestPath);
  if (!result.ok) {
    console.error('FIXTURE_CHECKSUM_FAILED');
    for (const err of result.errors) console.error(`- ${err}`);
    process.exit(1);
  }
  const log = {
    event: 'fixture_verified',
    fixture_id: result.fixtureId,
    schema_sha256: result.schemaSha256,
    fixture_sha256: result.fixtureSha256,
    manifest_path: manifestPath,
  };
  console.log(JSON.stringify(log));
  process.exit(0);
} catch (err) {
  console.error('FIXTURE_CHECKSUM_ERROR', err instanceof Error ? err.message : err);
  process.exit(1);
}
