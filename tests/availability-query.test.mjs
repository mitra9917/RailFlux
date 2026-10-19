import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RailFluxError, parseAvailabilityQuery } from '@railflux/shared';

const RUN_ID = 'a5012c27-3b3a-4114-bea2-a33ec2bea8d7';

test('parseAvailabilityQuery accepts valid uuid, class, and quota', () => {
  const q = parseAvailabilityQuery({
    trainRunId: RUN_ID,
    class: '3A',
    quota: 'TATKAL',
  });
  assert.deepEqual(q, { trainRunId: RUN_ID, class: '3A', quota: 'TATKAL' });
});

test('parseAvailabilityQuery rejects invalid input', () => {
  for (const raw of [
    { trainRunId: 'not-uuid', class: '3A', quota: 'TATKAL' },
    { trainRunId: RUN_ID, class: '1A', quota: 'TATKAL' },
    { trainRunId: RUN_ID, class: '3A', quota: 'GENERAL' },
    { class: '3A', quota: 'TATKAL' },
  ]) {
    assert.throws(() => parseAvailabilityQuery(raw), (err) => {
      return err instanceof RailFluxError && err.errorCode === 'VALIDATION_ERROR';
    });
  }
});
