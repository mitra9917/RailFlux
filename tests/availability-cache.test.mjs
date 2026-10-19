import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availabilityCacheKey } from '../services/read/dist/cache/availability-cache.js';

test('availabilityCacheKey matches cache-and-queue design prefix', () => {
  const trainRunId = 'a5012c27-3b3a-4114-bea2-a33ec2bea8d7';
  assert.equal(
    availabilityCacheKey({ trainRunId, class: '3A', quota: 'TATKAL' }),
    `v1:availability:${trainRunId}:3A:TATKAL`,
  );
});
