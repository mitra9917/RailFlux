import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');
const frontend = join(root, 'frontend');

test('Compare page and dual-stack script exist', () => {
  const app = readFileSync(join(frontend, 'src/App.tsx'), 'utf8');
  assert.match(app, /path="compare"/);
  const vite = readFileSync(join(frontend, 'vite.config.ts'), 'utf8');
  assert.match(vite, /compare-baseline/);
  assert.match(vite, /compare-optimized/);
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['compare:dual-stack'], /compare-dual-stack/);
  const data = readFileSync(join(frontend, 'public/comparison-data.json'), 'utf8');
  const json = JSON.parse(data);
  assert.ok(json.pairs?.length >= 1);
});
