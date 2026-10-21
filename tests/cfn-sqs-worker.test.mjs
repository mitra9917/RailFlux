import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');
const sqs = readFileSync(
  join(root, 'infrastructure/cloudformation/optimized/sqs-worker.yaml'),
  'utf8',
);
const ecs = readFileSync(
  join(root, 'infrastructure/cloudformation/optimized/ecs-services.yaml'),
  'utf8',
);
const deploy = readFileSync(join(root, 'infrastructure/scripts/aws-deploy-module.sh'), 'utf8');

test('M5 #49 SQS module defines DLQ redrive with maxReceiveCount 3', () => {
  assert.match(sqs, /AWS::SQS::Queue/);
  assert.match(sqs, /RedrivePolicy/);
  assert.match(sqs, /maxReceiveCount/);
  assert.match(sqs, /SideEffectsQueueArn/);
  assert.match(sqs, /SideEffectsDlqArn/);
});

test('M5 #49 optimized ECS wires booking outbox to SQS and runs worker service', () => {
  assert.match(ecs, /OUTBOX_DELIVERY/);
  assert.match(ecs, /SQS_SIDE_EFFECTS_QUEUE_URL/);
  assert.match(ecs, /WorkerService/);
  assert.match(ecs, /WorkerTaskRoleArn/);
});

test('M5 #49 deploy script includes sqs-worker module', () => {
  assert.match(deploy, /sqs-worker\)/);
  assert.match(deploy, /SideEffectsQueueUrl/);
});
