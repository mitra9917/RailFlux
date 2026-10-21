import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const rdsPath = join(
  import.meta.dirname,
  '..',
  'infrastructure/cloudformation/shared/rds-primary.yaml',
);

test('M5 #43 RDS primary is Single-AZ private MySQL with managed secret', () => {
  const rds = readFileSync(rdsPath, 'utf8');
  assert.match(rds, /Engine: mysql/);
  assert.match(rds, /MultiAZ: false/);
  assert.match(rds, /PubliclyAccessible: false/);
  assert.match(rds, /ManageMasterUserPassword: true/);
  assert.match(rds, /DbEndpointAddress/);
  assert.match(rds, /DbMasterSecretArn/);
  assert.match(rds, /DBSubnetGroup/);
});

test('M5 #43 migrate smoke script wires stack outputs to migrate.sh', () => {
  const smoke = readFileSync(
    join(import.meta.dirname, '..', 'infrastructure/scripts/aws-rds-migrate-smoke.sh'),
    'utf8',
  );
  assert.match(smoke, /DbEndpointAddress/);
  assert.match(smoke, /DbMasterSecretArn/);
  assert.match(smoke, /database\/scripts\/migrate\.sh/);
});
