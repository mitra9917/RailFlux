import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');
const baseline = readFileSync(
  join(root, 'infrastructure/cloudformation/baseline/ecs-monolith.yaml'),
  'utf8',
);
const optimized = readFileSync(
  join(root, 'infrastructure/cloudformation/optimized/ecs-services.yaml'),
  'utf8',
);

test('M5 #46 baseline Fargate monolith attaches to external target group', () => {
  assert.match(baseline, /AWS::ECS::TaskDefinition/);
  assert.match(baseline, /TargetGroupArn/);
  assert.match(baseline, /ResourceParityBaseline/);
  assert.match(baseline, /LaunchType: FARGATE/);
});

test('M5 #46 optimized split services expose edge on ALB; booking uses primary DB', () => {
  assert.match(optimized, /BookingTaskDefinition/);
  assert.match(optimized, /MYSQL_HOST\n              Value: !Ref DbPrimaryEndpoint/s);
  assert.match(optimized, /EdgeTargetGroupArn/);
  assert.match(optimized, /ServiceDiscoveryNamespace/);
  assert.match(optimized, /ResourceParityOptimized/);
});

test('M5 #46 deploy script includes ecs-baseline and ecs-optimized modules', () => {
  const deploy = readFileSync(join(root, 'infrastructure/scripts/aws-deploy-module.sh'), 'utf8');
  assert.match(deploy, /ecs-baseline/);
  assert.match(deploy, /ecs-optimized/);
});
