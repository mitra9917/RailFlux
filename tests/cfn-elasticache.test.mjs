import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');
const cachePath = join(root, 'infrastructure/cloudformation/optimized/elasticache.yaml');
const windowDoc = join(root, 'infrastructure/cloudformation/optimized/elasticache-test-window.md');
const manifest = readFileSync(join(root, 'experiment/run-manifest.template.yaml'), 'utf8');

test('M5 #45 ElastiCache is single-node Redis in private subnets', () => {
  const yaml = readFileSync(cachePath, 'utf8');
  assert.match(yaml, /AWS::ElastiCache::CacheCluster/);
  assert.match(yaml, /NumCacheNodes: 1/);
  assert.match(yaml, /RedisSubnetGroup/);
  assert.match(yaml, /RedisSecurityGroupId/);
  assert.match(yaml, /RedisUrl/);
  assert.match(yaml, /TestWindowOnly: true/);
});

test('M5 #45 cost plan documented for run manifest', () => {
  const doc = readFileSync(windowDoc, 'utf8');
  assert.match(doc, /cache_class/);
  assert.match(doc, /expires_at/);
  assert.match(manifest, /cache_class:/);
  assert.match(manifest, /expires_at:/);
});
