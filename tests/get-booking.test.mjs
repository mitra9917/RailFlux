import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBookingIdParam } from '@railflux/shared';

test('parseBookingIdParam accepts lowercase UUID', () => {
  assert.equal(
    parseBookingIdParam('a5012c27-3b3a-4114-bea2-a33ec2bea8d7'),
    'a5012c27-3b3a-4114-bea2-a33ec2bea8d7',
  );
});

test('parseBookingIdParam rejects non-uuid', () => {
  assert.throws(() => parseBookingIdParam('not-a-uuid'), /Invalid bookingId/);
});
