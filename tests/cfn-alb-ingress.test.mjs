import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');
const alb = readFileSync(join(root, 'infrastructure/cloudformation/shared/alb-ingress.yaml'), 'utf8');
const waf = readFileSync(join(root, 'infrastructure/cloudformation/edge/waf.yaml'), 'utf8');
const ecs = readFileSync(join(root, 'infrastructure/cloudformation/baseline/ecs-monolith.yaml'), 'utf8');

test('M5 #47 ALB ingress enforces origin header and HTTPS', () => {
  assert.match(alb, /OriginVerifyForwardRule/);
  assert.match(alb, /fixed-response/);
  assert.match(alb, /403/);
  assert.match(alb, /WafMode/);
  assert.match(alb, /HealthCheckPath: \/health\/ready/);
});

test('M5 #47 CloudFront WAF includes managed rules and rate limit hooks', () => {
  assert.match(waf, /AWSManagedRulesCommonRuleSet/);
  assert.match(waf, /RateBasedStatement/);
  assert.match(waf, /CloudFrontWebAclArn/);
});

test('M5 #47 ECS monolith attaches to external target group', () => {
  assert.doesNotMatch(ecs, /AWS::ElasticLoadBalancingV2::LoadBalancer/);
  assert.match(ecs, /TargetGroupArn/);
});

test('M5 #47 deploy script wires alb modules before ecs', () => {
  const deploy = readFileSync(join(root, 'infrastructure/scripts/aws-deploy-module.sh'), 'utf8');
  assert.match(deploy, /alb-baseline \| alb-optimized/);
  assert.match(deploy, /--acm-certificate-arn/);
  assert.match(deploy, /Deploy alb-baseline first/);
});
