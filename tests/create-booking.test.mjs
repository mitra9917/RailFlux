import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RailFluxError, parseCreateBookingBody } from '@railflux/shared';

const valid = {
  userId: '11111111-1111-4111-8111-111111111111',
  inventoryId: 'c0714d77-5e36-4aeb-a001-dd17aa3809c3',
  passengers: [{ syntheticName: 'Synthetic Pax', age: 30 }],
  paymentToken: 'stub-token-1',
};

test('parseCreateBookingBody accepts valid CreateBooking', () => {
  assert.deepEqual(parseCreateBookingBody(valid), valid);
});

test('parseCreateBookingBody rejects invalid passengers and paymentToken', () => {
  for (const body of [
    { ...valid, passengers: [] },
    { ...valid, paymentToken: 'short' },
    { ...valid, userId: 'not-a-uuid' },
  ]) {
    assert.throws(() => parseCreateBookingBody(body), (err) => {
      return err instanceof RailFluxError && err.errorCode === 'VALIDATION_ERROR';
    });
  }
});
