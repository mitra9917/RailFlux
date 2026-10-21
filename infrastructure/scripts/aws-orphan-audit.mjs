#!/usr/bin/env node
/**
 * Post-teardown orphan inventory for RailFlux (M5 #53).
 * Matches docs/runbooks/teardown.md — exits non-zero when paid orphans remain.
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const RAILFLUX_APP_REGION = process.env.RAILFLUX_APP_REGION || 'ap-south-1';
export const RAILFLUX_EDGE_REGION = process.env.RAILFLUX_EDGE_REGION || 'us-east-1';
export const RAILFLUX_AUDIT_REGIONS = [RAILFLUX_APP_REGION, RAILFLUX_EDGE_REGION];

export const ALLOWLIST_STACKS = new Set(['railflux-account-budgets']);

/** Stack statuses that still represent billable or blocking infrastructure. */
export const ACTIVE_STACK_STATUSES = new Set([
  'CREATE_IN_PROGRESS',
  'CREATE_COMPLETE',
  'CREATE_FAILED',
  'ROLLBACK_IN_PROGRESS',
  'ROLLBACK_FAILED',
  'ROLLBACK_COMPLETE',
  'DELETE_IN_PROGRESS',
  'DELETE_FAILED',
  'UPDATE_IN_PROGRESS',
  'UPDATE_COMPLETE',
  'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS',
  'UPDATE_ROLLBACK_IN_PROGRESS',
  'UPDATE_ROLLBACK_FAILED',
  'UPDATE_ROLLBACK_COMPLETE',
  'UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS',
  'REVIEW_IN_PROGRESS',
  'IMPORT_IN_PROGRESS',
  'IMPORT_COMPLETE',
  'IMPORT_ROLLBACK_IN_PROGRESS',
  'IMPORT_ROLLBACK_FAILED',
  'IMPORT_ROLLBACK_COMPLETE',
]);

const PAID_RESOURCE_TYPES = new Set([
  'ec2:instance',
  'ec2:natgateway',
  'ec2:elastic-ip',
  'elasticloadbalancing:loadbalancer',
  'elasticloadbalancing:targetgroup',
  'rds:db',
  'rds:cluster',
  'elasticache:cluster',
  'ecs:service',
  'ecs:cluster',
  'cloudfront:distribution',
  'wafv2:webacl',
  'wafv2:rulegroup',
  'sqs:queue',
]);

/**
 * @param {string} name
 * @param {string | undefined} session
 */
export function matchesSession(name, session) {
  if (!session) return true;
  return (
    name.endsWith(`-${session}`) ||
    name.includes(`-${session}-`) ||
    name.includes(`/railflux/${session}/`) ||
    name.includes(`/${session}/`)
  );
}

/**
 * @param {{ StackName: string, StackStatus: string }[]} stacks
 * @param {{ session?: string }} options
 * @returns {{ region: string, kind: string, id: string, detail: string, paid: boolean }[]}
 */
export function findingsFromStacks(stacks, region, options = {}) {
  const { session } = options;
  /** @type {ReturnType<typeof findingsFromStacks>} */
  const findings = [];
  for (const stack of stacks) {
    const name = stack.StackName;
    if (!name.startsWith('railflux-')) continue;
    if (ALLOWLIST_STACKS.has(name)) continue;
    if (!matchesSession(name, session)) continue;
    if (stack.StackStatus === 'DELETE_COMPLETE') continue;
    if (!ACTIVE_STACK_STATUSES.has(stack.StackStatus)) continue;
    findings.push({
      region,
      kind: 'cloudformation-stack',
      id: name,
      detail: stack.StackStatus,
      paid: true,
    });
  }
  return findings;
}

/**
 * @param {{ ResourceARN?: string, Tags?: { Key: string, Value: string }[] }[]} resources
 * @param {string} region
 * @param {{ session?: string }} options
 */
export function findingsFromTaggedResources(resources, region, options = {}) {
  const { session } = options;
  /** @type {ReturnType<typeof findingsFromStacks>} */
  const findings = [];
  for (const resource of resources) {
    const arn = resource.ResourceARN || '';
    const tags = resource.Tags || [];
    const project = tags.find((t) => t.Key === 'Project')?.Value;
    if (project !== 'RailFlux' && !arn.toLowerCase().includes('railflux')) continue;
    const id = arn || tags.map((t) => `${t.Key}=${t.Value}`).join(',');
    if (!matchesSession(id, session)) continue;
    const type = arn.split(':')[2]?.toLowerCase() || 'unknown';
    const resourceType = arn.includes(':')
      ? `${type}:${arn.split(':')[5]?.split('/')[0]?.toLowerCase() || 'resource'}`
      : 'unknown';
    const paid = PAID_RESOURCE_TYPES.has(resourceType) || arn.toLowerCase().includes('railflux');
    findings.push({
      region,
      kind: 'tagged-resource',
      id,
      detail: resourceType,
      paid,
    });
  }
  return findings;
}

/**
 * @param {{ logGroupName?: string, retentionInDays?: number }[]} groups
 * @param {string} region
 * @param {{ session?: string }} options
 */
export function findingsFromLogGroups(groups, region, options = {}) {
  const { session } = options;
  /** @type {ReturnType<typeof findingsFromStacks>} */
  const findings = [];
  for (const group of groups) {
    const name = group.logGroupName || '';
    if (!name.startsWith('/railflux/')) continue;
    if (!matchesSession(name, session)) continue;
    findings.push({
      region,
      kind: 'logs-log-group',
      id: name,
      detail: group.retentionInDays ? `retention=${group.retentionInDays}d` : 'retention=never',
      paid: true,
    });
  }
  return findings;
}

/**
 * @param {ReturnType<typeof findingsFromStacks>} findings
 */
export function paidOrphanFindings(findings) {
  return findings.filter((f) => f.paid);
}

export function formatFindingsReport(findings) {
  if (findings.length === 0) {
    return 'No RailFlux orphans detected in audited regions.';
  }
  return findings
    .map((f) => `[${f.region}] ${f.kind} ${f.id} (${f.detail})${f.paid ? ' [paid]' : ''}`)
    .join('\n');
}

/**
 * @param {string[]} awsArgs
 * @param {string} region
 * @param {(cmd: string, args: string[], region: string) => unknown} runAws
 */
function awsJson(awsArgs, region, runAws) {
  return runAws('aws', [...awsArgs, '--region', region, '--output', 'json'], region);
}

/**
 * @param {{ session?: string, regions?: string[], runAws?: typeof defaultRunAws }} options
 */
export async function auditRailFluxOrphans(options = {}) {
  const {
    session,
    regions = RAILFLUX_AUDIT_REGIONS,
    runAws = defaultRunAws,
  } = options;

  /** @type {ReturnType<typeof findingsFromStacks>} */
  const all = [];

  for (const region of regions) {
    const stackPayload = /** @type {{ StackSummaries?: { StackName: string, StackStatus: string }[] }} */ (
      awsJson(['cloudformation', 'list-stacks'], region, runAws)
    );
    all.push(...findingsFromStacks(stackPayload.StackSummaries || [], region, { session }));

    let nextToken;
    do {
      const tagArgs = [
        'resourcegroupstaggingapi',
        'get-resources',
        '--tag-filters',
        'Key=Project,Values=RailFlux',
      ];
      if (nextToken) tagArgs.push('--pagination-token', nextToken);
      const tagPayload = /** @type {{ ResourceTagMappingList?: object[], PaginationToken?: string }} */ (
        awsJson(tagArgs, region, runAws)
      );
      all.push(
        ...findingsFromTaggedResources(tagPayload.ResourceTagMappingList || [], region, {
          session,
        }),
      );
      nextToken = tagPayload.PaginationToken;
    } while (nextToken);

    const logPayload = /** @type {{ logGroups?: { logGroupName?: string, retentionInDays?: number }[] }} */ (
      awsJson(['logs', 'describe-log-groups', '--log-group-name-prefix', '/railflux/'], region, runAws)
    );
    all.push(...findingsFromLogGroups(logPayload.logGroups || [], region, { session }));
  }

  const dedup = new Map();
  for (const f of all) {
    dedup.set(`${f.region}|${f.kind}|${f.id}`, f);
  }
  return [...dedup.values()];
}

function defaultRunAws(cmd, args) {
  const out = execFileSync(cmd, args, {
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(out);
}

function parseArgs(argv) {
  /** @type {{ session?: string, json: boolean, help: boolean }} */
  const opts = { json: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--session') {
      opts.session = argv[++i];
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return opts;
}

function usage() {
  console.error(`Usage:
  aws-orphan-audit.mjs [--session NAME] [--json]

Scans ${RAILFLUX_AUDIT_REGIONS.join(' and ')} for RailFlux stacks, tagged resources,
and /railflux/ log groups. Exits 1 when paid orphans remain (excluding railflux-account-budgets).
`);
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    usage();
    process.exit(1);
  }
  if (opts.help) {
    usage();
    process.exit(0);
  }

  const findings = await auditRailFluxOrphans({ session: opts.session });
  const paid = paidOrphanFindings(findings);
  const payload = {
    ok: paid.length === 0,
    session: opts.session || null,
    regions: RAILFLUX_AUDIT_REGIONS,
    findingCount: findings.length,
    paidOrphanCount: paid.length,
    findings,
    paidOrphans: paid,
  };

  if (opts.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(formatFindingsReport(findings));
    if (paid.length > 0) {
      console.error(`\nFAIL: ${paid.length} paid RailFlux orphan(s) remain. See teardown runbook.`);
    } else {
      console.log('\nOK: no paid RailFlux orphans in audited regions.');
    }
  }
  process.exit(paid.length === 0 ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  });
}
