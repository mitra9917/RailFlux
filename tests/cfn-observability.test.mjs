import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { buildAwsOtelProcessEnv, buildOtelResourceAttributes } from '@railflux/shared';

const root = join(import.meta.dirname, '..');
const obs = readFileSync(
  join(root, 'infrastructure/cloudformation/shared/observability.yaml'),
  'utf8',
);
const iam = readFileSync(
  join(root, 'infrastructure/cloudformation/shared/iam-task-roles.yaml'),
  'utf8',
);

test('M5 #50 observability exports run_id metrics namespace and SLO alarms', () => {
  assert.match(obs, /RailFlux\/\$\{RunId\}/);
  assert.match(obs, /AWS::Logs::MetricFilter/);
  assert.match(obs, /BookingRequestDurationMs/);
  assert.match(obs, /AWS::CloudWatch::Dashboard/);
  assert.match(obs, /SideEffectsDlqDepthAlarm/);
});

test('M5 #50 IAM grants telemetry export for task roles', () => {
  assert.match(iam, /xray:PutTraceSegments/);
  assert.match(iam, /cloudwatch:PutMetricData/);
});

test('M5 #50 shared OTEL env includes run_id namespace', () => {
  const attrs = buildOtelResourceAttributes('run-abc', 'aws-optimized');
  assert.match(attrs, /run_id=run-abc/);
  const env = buildAwsOtelProcessEnv('run-abc', 'aws-baseline');
  assert.equal(env.OTEL_TRACES_SAMPLER_ARG, '0.1');
});
