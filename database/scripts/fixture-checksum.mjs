#!/usr/bin/env node
/**
 * Compute and verify fixture/schema checksums for experiment/fixtures/manifest.yaml.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '../..');
export const FIXTURE_GENERATOR_VERSION = '1';

export function normalizeManifestText(raw) {
  return raw.replace(/\r\n/g, '\n');
}

export function readManifest(manifestPath) {
  const text = normalizeManifestText(fs.readFileSync(manifestPath, 'utf8'));
  const fixtureId = text.match(/^fixture_id:\s*"?([^"\n#]+)"?/m)?.[1]?.trim();
  if (!fixtureId) throw new Error('manifest missing fixture_id');
  const schemaSha = text.match(/^  schema_sha256:\s*(\S+)/m)?.[1]?.trim();
  const fixtureSha = text.match(/^  fixture_sha256:\s*(\S+)/m)?.[1]?.trim();
  return { text, fixtureId, schemaSha, fixtureSha };
}

export function computeSchemaSha256(migrationsDir = path.join(REPO_ROOT, 'database/migrations')) {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  if (files.length === 0) throw new Error(`no migrations in ${migrationsDir}`);
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(migrationsDir, file)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function computeFixtureSha256(manifestPath, env = process.env) {
  const generator = path.join(__dirname, 'generate-seed-sql.mjs');
  const result = spawnSync(process.execPath, [generator], {
    cwd: REPO_ROOT,
    env: { ...env, FIXTURE_MANIFEST: manifestPath, FIXTURE_GENERATOR_VERSION },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'generate-seed-sql failed');
  }
  const hash = createHash('sha256');
  hash.update(FIXTURE_GENERATOR_VERSION);
  hash.update('\0');
  hash.update(result.stdout);
  return hash.digest('hex');
}

export function verifyFixtureManifest(manifestPath) {
  const { fixtureId, schemaSha, fixtureSha } = readManifest(manifestPath);
  const expectedSchema = computeSchemaSha256();
  const expectedFixture = computeFixtureSha256(manifestPath);

  const errors = [];
  if (!schemaSha || schemaSha === 'TO_BE_GENERATED') {
    errors.push('manifest checksums.schema_sha256 is not set');
  } else if (schemaSha !== expectedSchema) {
    errors.push(`schema_sha256 mismatch (expected ${expectedSchema}, manifest ${schemaSha})`);
  }

  if (!fixtureSha || fixtureSha === 'TO_BE_GENERATED') {
    errors.push('manifest checksums.fixture_sha256 is not set');
  } else if (fixtureSha !== expectedFixture) {
    errors.push(`fixture_sha256 mismatch (expected ${expectedFixture}, manifest ${fixtureSha})`);
  }

  return {
    ok: errors.length === 0,
    fixtureId,
    schemaSha256: expectedSchema,
    fixtureSha256: expectedFixture,
    manifestSchemaSha256: schemaSha,
    manifestFixtureSha256: fixtureSha,
    errors,
  };
}
