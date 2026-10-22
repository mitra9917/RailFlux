import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  ST005_BASELINE_CASES,
  ST005_OPTIMIZED_CASES,
  isAllowed,
  runSt005Case,
  runSt005Suite,
} from '../infrastructure/scripts/aws-security-st005.mjs';

const root = join(import.meta.dirname, '..');

test('M5 #54 ST-005 optimized matrix covers iam-matrix negatives', () => {
  const ids = ST005_OPTIMIZED_CASES.map((c) => c.id);
  assert.ok(ids.includes('read-no-sqs-send'));
  assert.ok(ids.includes('booking-no-sqs-receive'));
  assert.ok(ids.includes('worker-no-sqs-send'));
  assert.ok(ids.includes('booking-can-publish'));
  assert.ok(ids.includes('worker-can-consume'));
});

test('M5 #54 ST-005 baseline matrix denies SQS on monolith role', () => {
  assert.equal(ST005_BASELINE_CASES.length, 2);
  assert.equal(ST005_BASELINE_CASES[0].roleOutputKey, 'BaselineMonolithTaskRoleArn');
});

test('M5 #54 simulate result helper treats allowed correctly', () => {
  assert.equal(isAllowed('allowed'), true);
  assert.equal(isAllowed('explicitDeny'), false);
  assert.equal(isAllowed('implicitDeny'), false);
});

test('M5 #54 runSt005Suite honors expectAllowed', () => {
  const fakeAws = () => ({
    EvaluationResults: [{ EvalActionName: 'sqs:SendMessage', EvalDecision: 'implicitDeny' }],
  });
  const report = runSt005Suite(
    [ST005_OPTIMIZED_CASES[0]],
    { ReadTaskRoleArn: 'arn:aws:iam::123:role/read' },
    { queueArn: 'arn:aws:sqs:ap-south-1:123:q' },
    fakeAws,
  );
  assert.equal(report.ok, true);

  const allowAws = () => ({
    EvaluationResults: [{ EvalActionName: 'sqs:SendMessage', EvalDecision: 'allowed' }],
  });
  const fail = runSt005Suite(
    [ST005_OPTIMIZED_CASES[0]],
    { ReadTaskRoleArn: 'arn:aws:iam::123:role/read' },
    { queueArn: 'arn:aws:sqs:ap-south-1:123:q' },
    allowAws,
  );
  assert.equal(fail.ok, false);
});

test('M5 #54 runSt005Case reports missing ARN', () => {
  const r = runSt005Case(ST005_OPTIMIZED_CASES[0], { roleArn: '', queueArn: 'arn:q' }, () => ({}));
  assert.equal(r.ok, false);
});

test('M5 #54 security smoke scripts exist and document evidence', () => {
  const combined = readFileSync(
    join(root, 'infrastructure/scripts/aws-security-smoke.sh'),
    'utf8',
  );
  assert.match(combined, /ST-004/);
  assert.match(combined, /ST-005/);
  assert.match(combined, /evidence/);
  const st004 = readFileSync(
    join(root, 'infrastructure/scripts/aws-security-st004-smoke.sh'),
    'utf8',
  );
  assert.match(st004, /403/);
});
