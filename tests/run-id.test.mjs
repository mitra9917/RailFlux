import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseOptionalRunId, readRunIdHeader } from '@railflux/shared';

test('parseOptionalRunId accepts OpenAPI run id pattern', () => {
  assert.equal(parseOptionalRunId('run-2026-pilot'), 'run-2026-pilot');
  assert.equal(parseOptionalRunId(undefined), undefined);
});

test('parseOptionalRunId rejects invalid values', () => {
  assert.equal(parseOptionalRunId('short'), undefined);
  assert.equal(parseOptionalRunId('bad id with spaces'), undefined);
});

test('readRunIdHeader reads X-Run-Id case-insensitively', () => {
  assert.equal(
    readRunIdHeader({ 'x-run-id': 'experiment_001' }),
    'experiment_001',
  );
});
