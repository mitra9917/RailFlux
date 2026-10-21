import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');
const iamPath = join(root, 'infrastructure/cloudformation/shared/iam-task-roles.yaml');
const networkPath = join(root, 'infrastructure/cloudformation/shared/network.yaml');

function iamText() {
  return readFileSync(iamPath, 'utf8');
}

test('M5 #42 network template implements SG matrix ingress patterns', () => {
  const network = readFileSync(networkPath, 'utf8');
  assert.match(network, /AlbSecurityGroup/);
  assert.match(network, /SourcePrefixListId: !Ref CloudFrontOriginPrefixListId/);
  assert.match(network, /RdsFromEcsIngress/);
  assert.match(network, /RedisFromEcsIngress/);
  assert.match(network, /EcsFromAlbIngress/);
  assert.match(network, /3306/);
  assert.match(network, /6379/);
});

test('M5 #42 read and edge roles have no SQS actions (ST-005 prep)', () => {
  const iam = iamText();
  const readBlock = iam.slice(iam.indexOf('ReadTaskRole:'), iam.indexOf('BookingTaskRole:'));
  const edgeBlock = iam.slice(iam.indexOf('EdgeTaskRole:'), iam.indexOf('Outputs:'));
  assert.doesNotMatch(readBlock, /sqs:/);
  assert.doesNotMatch(edgeBlock, /sqs:/);
});

test('M5 #42 booking publishes and worker consumes without cross-service queue access', () => {
  const iam = iamText();
  const bookingPublish = iam.slice(
    iam.indexOf('BookingSideEffectsPublishPolicy:'),
    iam.indexOf('WorkerTaskRole:'),
  );
  const workerConsume = iam.slice(
    iam.indexOf('WorkerSideEffectsConsumePolicy:'),
    iam.indexOf('WorkerDlqInspectPolicy:'),
  );

  assert.match(bookingPublish, /sqs:SendMessage/);
  assert.doesNotMatch(bookingPublish, /sqs:ReceiveMessage/);
  assert.doesNotMatch(bookingPublish, /sqs:DeleteMessage/);

  assert.match(workerConsume, /sqs:ReceiveMessage/);
  assert.match(workerConsume, /sqs:DeleteMessage/);
  assert.doesNotMatch(workerConsume, /sqs:SendMessage/);
});

test('M5 #42 baseline monolith template section excludes SQS', () => {
  const iam = iamText();
  const baselineBlock = iam.slice(iam.indexOf('BaselineMonolithTaskRole:'), iam.indexOf('ReadTaskRole:'));
  assert.doesNotMatch(baselineBlock, /sqs:/);
});
