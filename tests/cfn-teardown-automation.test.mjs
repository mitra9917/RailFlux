import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  ALLOWLIST_STACKS,
  findingsFromLogGroups,
  findingsFromStacks,
  matchesSession,
  paidOrphanFindings,
} from '../infrastructure/scripts/aws-orphan-audit.mjs';
import { appendTeardownRecord } from '../infrastructure/scripts/aws-run-manifest.mjs';

const root = join(import.meta.dirname, '..');

test('M5 #53 allowlists account budget stack only', () => {
  assert.equal(ALLOWLIST_STACKS.has('railflux-account-budgets'), true);
  assert.equal(ALLOWLIST_STACKS.has('railflux-network-lab'), false);
});

test('M5 #53 stack findings respect session filter', () => {
  const stacks = [
    { StackName: 'railflux-network-lab-a', StackStatus: 'CREATE_COMPLETE' },
    { StackName: 'railflux-network-lab-b', StackStatus: 'CREATE_COMPLETE' },
    { StackName: 'railflux-account-budgets', StackStatus: 'CREATE_COMPLETE' },
  ];
  const all = findingsFromStacks(stacks, 'ap-south-1', {});
  assert.equal(all.length, 2);
  const scoped = findingsFromStacks(stacks, 'ap-south-1', { session: 'lab-a' });
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0].id, 'railflux-network-lab-a');
});

test('M5 #53 session name matching', () => {
  assert.equal(matchesSession('railflux-ecs-baseline-smoke1', 'smoke1'), true);
  assert.equal(matchesSession('railflux-ecs-baseline-smoke1', 'smoke'), false);
});

test('M5 #53 log groups under /railflux/ are paid orphans', () => {
  const findings = findingsFromLogGroups(
    [{ logGroupName: '/railflux/smoke/edge', retentionInDays: 7 }],
    'ap-south-1',
    { session: 'smoke' },
  );
  assert.equal(findings.length, 1);
  assert.equal(paidOrphanFindings(findings).length, 1);
});

test('M5 #53 appendTeardownRecord writes manifest footer once', () => {
  const dir = mkdtempSync(join(tmpdir(), 'railflux-teardown-'));
  const manifestPath = join(dir, 'run.yaml');
  writeFileSync(manifestPath, 'run_id: run-1\n');
  appendTeardownRecord(manifestPath, { auditor: 'operator1', completedAt: '2026-10-22T00:00:00Z' });
  const text = readFileSync(manifestPath, 'utf8');
  assert.match(text, /teardown:\n  completed_at: 2026-10-22T00:00:00Z/);
  assert.match(text, /auditor: operator1/);
  assert.throws(() => appendTeardownRecord(manifestPath, { auditor: 'operator1' }));
});

test('M5 #53 teardown session script documents dry-run default', () => {
  const session = readFileSync(
    join(root, 'infrastructure/scripts/aws-teardown-session.sh'),
    'utf8',
  );
  assert.match(session, /--dry-run/);
  assert.match(session, /--execute/);
  assert.match(session, /aws-orphan-audit/);
  assert.match(session, /profile all/);
});
