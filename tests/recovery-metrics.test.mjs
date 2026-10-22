import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  bucketHttpOutcomesFromK6Raw,
  buildRecoveryMetrics,
  computeRecoveryFromBuckets,
} from '../experiment/controller/recovery-metrics.mjs';
import { buildExperimentResult } from '../experiment/controller/export-result.mjs';
import { validateExperimentResult } from '../experiment/controller/validate-result-schema.mjs';

test('M7 #65 recovery from bucketed k6 raw', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rf-recovery-'));
  const rawPath = join(dir, 'raw.ndjson');
  const t0 = '2026-01-01T00:00:00.000Z';
  const lines = [];
  for (let s = 0; s < 120; s += 1) {
    const time = new Date(Date.parse(t0) + s * 1000).toISOString();
    const failed = s >= 60 && s < 90;
    for (let i = 0; i < 10; i += 1) {
      lines.push(
        JSON.stringify({
          type: 'Point',
          metric: 'http_req_duration',
          data: {
            time,
            value: 10,
            tags: { expected_response: failed ? 'false' : 'true', status: failed ? '503' : '200' },
          },
        }),
      );
    }
  }
  writeFileSync(rawPath, `${lines.join('\n')}\n`, 'utf8');

  const buckets = bucketHttpOutcomesFromK6Raw(rawPath, 5);
  assert.ok(buckets.buckets.length >= 20);

  const recovery = computeRecoveryFromBuckets({
    injectionOffsetSeconds: 60,
    rawPaths: [rawPath],
    bucketSeconds: 5,
    sustainBuckets: 3,
  });
  assert.ok(recovery.peak_technical_error_rate > 0.5);
  assert.equal(recovery.slo_restored, true);
  assert.equal(recovery.recovery_time_seconds, 30);
});

test('M7 #65 buildExperimentResult includes recovery for failure load', () => {
  const result = buildExperimentResult({
    runId: 'failure-run-1',
    valid: true,
    manifest: {
      pairId: 'FT-005-baseline',
      architecture: 'baseline',
      loadLevel: 'failure',
      requestSeed: 1,
      failureInjection: {
        enabled: true,
        type: 'db_latency_250ms',
        offset_seconds: 60,
        failure_test_id: 'FT-005',
      },
    },
    fixtureVerification: { fixture_sha256: 'abc' },
    correctness: { event: 'correctness_passed' },
    k6Artifacts: [],
  });
  assert.ok(result.recovery);
  assert.equal(result.recovery.failure_test_id, 'FT-005');
  assert.equal(result.load_level, 'failure');
  const validation = validateExperimentResult(result);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
});

test('M7 #65 buildRecoveryMetrics tolerates missing raw', () => {
  const recovery = buildRecoveryMetrics({
    failureTestId: 'FT-001',
    failureInjectionType: 'task_loss',
    injectionOffsetSeconds: 60,
    k6Artifacts: [],
  });
  assert.equal(recovery.failure_test_id, 'FT-001');
  assert.equal(recovery.recovery_time_seconds, null);
  assert.equal(recovery.slo_restored, false);
});
