import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');
const replicaPath = join(root, 'infrastructure/cloudformation/optimized/rds-replica.yaml');
const routingPath = join(root, 'infrastructure/cloudformation/optimized/db-routing.md');
const deployModule = readFileSync(
  join(root, 'infrastructure/scripts/aws-deploy-module.sh'),
  'utf8',
);

test('M5 #44 read replica is non-public and tied to primary', () => {
  const replica = readFileSync(replicaPath, 'utf8');
  assert.match(replica, /SourceDBInstanceIdentifier/);
  assert.match(replica, /PubliclyAccessible: false/);
  assert.match(replica, /DbReplicaEndpointAddress/);
  assert.match(replica, /read-replica/);
});

test('M5 #44 booking stays on primary per routing doc', () => {
  const routing = readFileSync(routingPath, 'utf8');
  assert.match(routing, /booking.*primary/i);
  assert.match(routing, /read.*replica/i);
  assert.match(deployModule, /rds-replica/);
  assert.match(deployModule, /DbInstanceIdentifier/);
});
