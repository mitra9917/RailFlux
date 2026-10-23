import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RailFluxError, parseSearchTrainsQuery } from '@railflux/shared';

test('parseSearchTrainsQuery accepts valid station codes and ISO date', () => {
  const q = parseSearchTrainsQuery({ from: 'NDLS', to: 'BCT', date: '2026-04-01' });
  assert.deepEqual(q, { from: 'NDLS', to: 'BCT', date: '2026-04-01' });
});

test('parseSearchTrainsQuery accepts date-only catalogue listing', () => {
  const q = parseSearchTrainsQuery({ date: '2026-04-01' });
  assert.deepEqual(q, { from: null, to: null, date: '2026-04-01' });
});

test('parseSearchTrainsQuery rejects invalid stations and dates (TC-001 validation)', () => {
  for (const raw of [
    { from: 'ndls', to: 'BCT', date: '2026-04-01' },
    { from: 'NDLS', to: 'BCT', date: '2026-13-01' },
    { from: 'NDLS', to: 'BCT', date: 'not-a-date' },
    { from: 'NDLS', to: 'BCT' },
  ]) {
    assert.throws(() => parseSearchTrainsQuery(raw), (err) => {
      return err instanceof RailFluxError && err.errorCode === 'VALIDATION_ERROR';
    });
  }
});
