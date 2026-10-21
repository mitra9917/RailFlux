import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');
const cf = readFileSync(
  join(root, 'infrastructure/cloudformation/shared/cloudfront-oac.yaml'),
  'utf8',
);
const deploy = readFileSync(join(root, 'infrastructure/scripts/aws-deploy-module.sh'), 'utf8');

test('M5 #48 private S3 uses OAC and blocks public access', () => {
  assert.match(cf, /AWS::CloudFront::OriginAccessControl/);
  assert.match(cf, /PublicAccessBlockConfiguration/);
  assert.match(cf, /RestrictPublicBuckets: true/);
  assert.match(cf, /AllowCloudFrontOacRead/);
  assert.match(cf, /AWS:SourceArn/);
  assert.match(cf, /DenyInsecureTransport/);
});

test('M5 #48 CloudFront forwards /api/* to ALB with origin verify header', () => {
  assert.match(cf, /PathPattern: \/api\/\*/);
  assert.match(cf, /OriginCustomHeaders/);
  assert.match(cf, /OriginVerifyHeaderName/);
  assert.match(cf, /AlbDnsName/);
});

test('M5 #48 deploy script includes cloudfront modules after ALB', () => {
  assert.match(deploy, /cloudfront-baseline \| cloudfront-optimized/);
  assert.match(deploy, /Deploy alb-baseline first/);
});
