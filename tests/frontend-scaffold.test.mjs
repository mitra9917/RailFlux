import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = join(import.meta.dirname, '..');
const frontend = join(root, 'frontend');

test('M8 #71 frontend package uses React and Vite', () => {
  const pkg = JSON.parse(readFileSync(join(frontend, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@railflux/frontend');
  assert.ok(pkg.dependencies.react);
  assert.ok(pkg.devDependencies.vite);
  assert.ok(pkg.dependencies['@railflux/shared']);
});

test('M8 #71 env example documents API base URL and synthetic auth', () => {
  const env = readFileSync(join(frontend, '.env.example'), 'utf8');
  assert.match(env, /VITE_API_BASE_URL=/);
  assert.match(env, /VITE_SYNTHETIC/);
  assert.doesNotMatch(env, /password|aadhaar|pan|credit.?card/i);
});

test('M8 #71 UI copy warns against real credentials', () => {
  const authPanel = readFileSync(
    join(frontend, 'src/components/SyntheticAuthPanel.tsx'),
    'utf8',
  );
  assert.match(authPanel, /never real/i);
  assert.match(authPanel, /synthetic/i);
});

test('M8 #71 root scripts expose dev and build frontend', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.workspaces.join(','), /frontend/);
  assert.match(pkg.scripts['dev:frontend'], /@railflux\/frontend/);
  assert.match(pkg.scripts['build:frontend'], /build:shared/);
});

test('M8 #71 production build succeeds', () => {
  const res = spawnSync('npm', ['run', 'build:frontend'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, VITE_API_BASE_URL: 'http://127.0.0.1:3000' },
  });
  if (res.status !== 0) {
    console.error(res.stdout);
    console.error(res.stderr);
  }
  assert.equal(res.status, 0, 'build:frontend failed');
});
