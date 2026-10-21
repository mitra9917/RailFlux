import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');
const cfnDir = join(root, 'infrastructure/cloudformation');

function listYaml(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) out.push(...listYaml(path));
    else if (name.endsWith('.yaml')) out.push(path);
  }
  return out;
}

test('M5 #41 CloudFormation layout covers aws profiles and edge WAF region', () => {
  const baselineRoot = readFileSync(join(cfnDir, 'baseline/root.yaml'), 'utf8');
  const optimizedRoot = readFileSync(join(cfnDir, 'optimized/root.yaml'), 'utf8');
  const edgeWaf = readFileSync(join(cfnDir, 'edge/waf.yaml'), 'utf8');
  const edgeReadme = readFileSync(join(cfnDir, 'edge/README.md'), 'utf8');

  assert.match(baselineRoot, /aws-baseline/);
  assert.match(baselineRoot, /ap-south-1/);
  assert.match(optimizedRoot, /aws-optimized/);
  assert.match(optimizedRoot, /ap-south-1/);
  assert.match(edgeWaf, /us-east-1/);
  assert.match(edgeReadme, /us-east-1/);

  const templates = listYaml(cfnDir);
  assert.ok(templates.length >= 10, `expected module stubs, got ${templates.length}`);
  for (const file of templates) {
    const body = readFileSync(file, 'utf8');
    assert.match(body, /AWSTemplateFormatVersion/);
    assert.match(body, /^Resources:/m);
  }
});

test('deploy wrappers reference ap-south-1 and us-east-1 defaults', () => {
  const lib = readFileSync(join(root, 'infrastructure/scripts/cfn-lib.sh'), 'utf8');
  assert.match(lib, /ap-south-1/);
  assert.match(lib, /us-east-1/);
  assert.match(lib, /aws-edge-waf/);
});
