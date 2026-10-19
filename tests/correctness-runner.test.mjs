import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  bindCorrectnessSql,
  isCorrectnessViolation,
  parseCorrectnessChecks,
} from '../database/scripts/correctness-runner.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlPath = path.join(repoRoot, 'experiment/correctness.sql');

test('parseCorrectnessChecks splits experiment/correctness.sql into named checks', () => {
  const text = fs.readFileSync(sqlPath, 'utf8');
  const checks = parseCorrectnessChecks(text);
  assert.ok(checks.length >= 8);
  assert.ok(checks.every((c) => c.description && c.sql.includes('SELECT')));
  assert.match(checks[0].sql, /negative_inventory_count/);
});

test('bindCorrectnessSql substitutes run_id and fixture_id literals', () => {
  const bound = bindCorrectnessSql(
    'WHERE run_id = :run_id AND fixture_id = :fixture_id',
    { runId: "run-o'reilly", fixtureId: 'railflux-tatkal-v1' },
  );
  assert.match(bound, /run-o''reilly/);
  assert.match(bound, /railflux-tatkal-v1/);
});

test('isCorrectnessViolation treats scalar count rows as pass/fail', () => {
  assert.equal(isCorrectnessViolation([{ negative_inventory_count: 0 }]), false);
  assert.equal(isCorrectnessViolation([{ negative_inventory_count: 2 }]), true);
  assert.equal(isCorrectnessViolation([]), false);
  assert.equal(
    isCorrectnessViolation([{ consumed_inventory: 1, confirmed_seats: 0 }]),
    true,
  );
});
