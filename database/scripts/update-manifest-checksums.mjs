#!/usr/bin/env node
/** Refresh checksums section in experiment/fixtures/manifest.yaml (run when schema or seed generator changes). */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, computeFixtureSha256, computeSchemaSha256, normalizeManifestText } from './fixture-checksum.mjs';

const manifestPath = process.env.FIXTURE_MANIFEST
  ? path.resolve(process.env.FIXTURE_MANIFEST)
  : path.join(REPO_ROOT, 'experiment/fixtures/manifest.yaml');

const schemaSha = computeSchemaSha256();
const fixtureSha = computeFixtureSha256(manifestPath);
let text = normalizeManifestText(fs.readFileSync(manifestPath, 'utf8'));

text = text.replace(
  /^  schema_sha256:\s*\S+/m,
  `  schema_sha256: ${schemaSha}`,
);
text = text.replace(
  /^  fixture_sha256:\s*\S+/m,
  `  fixture_sha256: ${fixtureSha}`,
);

fs.writeFileSync(manifestPath, text.endsWith('\n') ? text : `${text}\n`);
console.log(JSON.stringify({ schema_sha256: schemaSha, fixture_sha256: fixtureSha, manifest_path: manifestPath }));
