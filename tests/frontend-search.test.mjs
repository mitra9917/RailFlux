import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');
const frontend = join(root, 'frontend');

test('M8 #72 vite dev proxy forwards /v1 and /health', () => {
  const vite = readFileSync(join(frontend, 'vite.config.ts'), 'utf8');
  assert.match(vite, /proxy/);
  assert.match(vite, /['"]\/v1['"]/);
  assert.match(vite, /['"]\/health['"]/);
  assert.match(vite, /stripViteClientWhenHmrOff|railflux-strip-vite-client/);
});

test('M8 #72 env example uses same-origin dev base URL', () => {
  const env = readFileSync(join(frontend, '.env.example'), 'utf8');
  assert.match(env, /VITE_API_BASE_URL=/);
  assert.match(env, /VITE_DEV_API_TARGET=/);
  assert.doesNotMatch(env, /127\.0\.0\.1:3000\/api/);
});

test('M8 #72 search and availability API modules', () => {
  const search = readFileSync(join(frontend, 'src/api/search.ts'), 'utf8');
  assert.match(search, /\/v1\/search/);
  assert.match(search, /\/v1\/availability/);
  assert.match(search, /VALIDATION_ERROR|parseApiJson/);
});

test('M8 #72 multipage routes for search flow', () => {
  const app = readFileSync(join(frontend, 'src/App.tsx'), 'utf8');
  assert.match(app, /path="search"/);
  assert.match(app, /path="availability"/);
  const pkg = JSON.parse(readFileSync(join(frontend, 'package.json'), 'utf8'));
  assert.ok(pkg.dependencies['react-router-dom']);
});
