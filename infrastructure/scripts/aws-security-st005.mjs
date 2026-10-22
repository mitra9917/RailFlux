#!/usr/bin/env node
/**
 * ST-005 IAM negative expectations (M5 #54). Uses iam:SimulatePrincipalPolicy.
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * @typedef {{ id: string, roleOutputKey: string, actions: string[], resource: 'queue' | 'dlq', expectAllowed: boolean }} St005Case
 */

/** @type {St005Case[]} */
export const ST005_OPTIMIZED_CASES = [
  {
    id: 'read-no-sqs-send',
    roleOutputKey: 'ReadTaskRoleArn',
    actions: ['sqs:SendMessage'],
    resource: 'queue',
    expectAllowed: false,
  },
  {
    id: 'read-no-sqs-receive',
    roleOutputKey: 'ReadTaskRoleArn',
    actions: ['sqs:ReceiveMessage'],
    resource: 'queue',
    expectAllowed: false,
  },
  {
    id: 'edge-no-sqs-send',
    roleOutputKey: 'EdgeTaskRoleArn',
    actions: ['sqs:SendMessage'],
    resource: 'queue',
    expectAllowed: false,
  },
  {
    id: 'booking-no-sqs-receive',
    roleOutputKey: 'BookingTaskRoleArn',
    actions: ['sqs:ReceiveMessage'],
    resource: 'queue',
    expectAllowed: false,
  },
  {
    id: 'booking-can-publish',
    roleOutputKey: 'BookingTaskRoleArn',
    actions: ['sqs:SendMessage'],
    resource: 'queue',
    expectAllowed: true,
  },
  {
    id: 'worker-no-sqs-send',
    roleOutputKey: 'WorkerTaskRoleArn',
    actions: ['sqs:SendMessage'],
    resource: 'queue',
    expectAllowed: false,
  },
  {
    id: 'worker-can-consume',
    roleOutputKey: 'WorkerTaskRoleArn',
    actions: ['sqs:ReceiveMessage'],
    resource: 'queue',
    expectAllowed: true,
  },
];

/** @type {St005Case[]} */
export const ST005_BASELINE_CASES = [
  {
    id: 'baseline-no-sqs-send',
    roleOutputKey: 'BaselineMonolithTaskRoleArn',
    actions: ['sqs:SendMessage'],
    resource: 'queue',
    expectAllowed: false,
  },
  {
    id: 'baseline-no-sqs-receive',
    roleOutputKey: 'BaselineMonolithTaskRoleArn',
    actions: ['sqs:ReceiveMessage'],
    resource: 'queue',
    expectAllowed: false,
  },
];

/**
 * @param {string} decision
 */
export function isAllowed(decision) {
  return decision === 'allowed';
}

/**
 * @param {St005Case} testCase
 * @param {{ roleArn: string, queueArn: string, dlqArn?: string }} arns
 * @param {(cmd: string, args: string[]) => unknown} runAws
 */
export function runSt005Case(testCase, arns, runAws) {
  const roleArn = arns.roleArn;
  const resourceArn = testCase.resource === 'dlq' ? arns.dlqArn : arns.queueArn;
  if (!roleArn || !resourceArn) {
    return {
      id: testCase.id,
      ok: false,
      error: 'missing role or resource ARN',
      decisions: [],
    };
  }
  const payload = /** @type {{ EvaluationResults?: { EvalActionName: string, EvalDecision: string }[] }} */ (
    runAws('aws', [
      'iam',
      'simulate-principal-policy',
      '--policy-source-arn',
      roleArn,
      '--action-names',
      ...testCase.actions,
      '--resource-arns',
      resourceArn,
      '--output',
      'json',
    ])
  );
  const decisions = (payload.EvaluationResults || []).map((r) => ({
    action: r.EvalActionName,
    decision: r.EvalDecision,
  }));
  const ok = decisions.every((d) => isAllowed(d.decision) === testCase.expectAllowed);
  return { id: testCase.id, ok, roleArn, resourceArn, expectAllowed: testCase.expectAllowed, decisions };
}

/**
 * @param {St005Case[]} cases
 * @param {Record<string, string>} roleOutputs
 * @param {{ queueArn: string, dlqArn?: string }} queue
 * @param {(cmd: string, args: string[]) => unknown} runAws
 */
export function runSt005Suite(cases, roleOutputs, queue, runAws) {
  /** @type {ReturnType<typeof runSt005Case>[]} */
  const results = [];
  for (const testCase of cases) {
    const roleArn = roleOutputs[testCase.roleOutputKey];
    results.push(
      runSt005Case(testCase, { roleArn, queueArn: queue.queueArn, dlqArn: queue.dlqArn }, runAws),
    );
  }
  return { ok: results.every((r) => r.ok), results };
}

function defaultRunAws(_cmd, args) {
  const out = execFileSync('aws', args, {
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(out);
}

function parseArgs(argv) {
  /** @type {{ profile: string, session: string, queueArn: string, dlqArn: string, rolesJson: string, json: boolean }} */
  const opts = {
    profile: 'aws-optimized',
    session: '',
    queueArn: '',
    dlqArn: '',
    rolesJson: '',
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--deployment-profile') opts.profile = argv[++i];
    else if (arg === '--session') opts.session = argv[++i];
    else if (arg === '--queue-arn') opts.queueArn = argv[++i];
    else if (arg === '--dlq-arn') opts.dlqArn = argv[++i];
    else if (arg === '--roles-json') opts.rolesJson = argv[++i];
    else if (arg === '--json') opts.json = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!opts.queueArn || !opts.rolesJson) {
    throw new Error('--queue-arn and --roles-json are required');
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const roleOutputs = JSON.parse(opts.rolesJson);
  const cases = opts.profile === 'aws-baseline' ? ST005_BASELINE_CASES : ST005_OPTIMIZED_CASES;
  const report = runSt005Suite(
    cases,
    roleOutputs,
    { queueArn: opts.queueArn, dlqArn: opts.dlqArn || undefined },
    defaultRunAws,
  );
  const payload = {
    testId: 'ST-005',
    session: opts.session || null,
    deploymentProfile: opts.profile,
    ok: report.ok,
    results: report.results,
    recordedAt: new Date().toISOString(),
  };
  if (opts.json) console.log(JSON.stringify(payload, null, 2));
  else {
    for (const r of report.results) {
      const mark = r.ok ? 'OK' : 'FAIL';
      console.log(`${mark} ${r.id}`);
      for (const d of r.decisions || []) {
        console.log(`    ${d.action}: ${d.decision}`);
      }
    }
    console.log(report.ok ? 'ST-005 PASS' : 'ST-005 FAIL');
  }
  process.exit(report.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  }
}
