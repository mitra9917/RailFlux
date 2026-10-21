import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');
const budget = readFileSync(
  join(root, 'infrastructure/cloudformation/shared/account-budgets.yaml'),
  'utf8',
);
const deploy = readFileSync(join(root, 'infrastructure/scripts/aws-deploy-module.sh'), 'utf8');

test('M5 #51 account budgets notify at $10/$25/$50/$75', () => {
  assert.match(budget, /AWS::Budgets::Budget/);
  assert.match(budget, /Threshold: 10/);
  assert.match(budget, /Threshold: 25/);
  assert.match(budget, /Threshold: 50/);
  assert.match(budget, /Threshold: 75/);
  assert.match(budget, /ABSOLUTE_VALUE/);
  assert.match(budget, /BudgetAlertEmail/);
});

test('M5 #51 includes Cost Anomaly Detection subscription', () => {
  assert.match(budget, /AWS::CE::AnomalyMonitor/);
  assert.match(budget, /AWS::CE::AnomalySubscription/);
});

test('M5 #51 deploy script supports account-budgets module', () => {
  assert.match(deploy, /account-budgets/);
  assert.match(deploy, /budget-alert-email/);
});
