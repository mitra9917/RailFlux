import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RailFluxError,
  hashBookingRequest,
  hashIdempotencyKey,
  parseIdempotencyKeyHeader,
} from '@railflux/shared';

const sampleBody = {
  userId: '11111111-1111-4111-8111-111111111111',
  inventoryId: 'c0714d77-5e36-4aeb-a001-dd17aa3809c3',
  passengers: [{ syntheticName: 'Synthetic Pax', age: 30 }],
  paymentToken: 'stub-token-1',
};

test('hashIdempotencyKey is stable and does not echo raw key', () => {
  const a = hashIdempotencyKey('client-key-1234567890ab');
  const b = hashIdempotencyKey('client-key-1234567890ab');
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.notEqual(a, 'client-key-1234567890ab');
});

test('hashBookingRequest is stable for equivalent body', () => {
  const h1 = hashBookingRequest(sampleBody);
  const h2 = hashBookingRequest({ ...sampleBody, passengers: [...sampleBody.passengers] });
  assert.equal(h1, h2);
});

test('parseIdempotencyKeyHeader enforces OpenAPI length bounds', () => {
  assert.throws(() => parseIdempotencyKeyHeader('short'), (err) => {
    return err instanceof RailFluxError && err.errorCode === 'VALIDATION_ERROR';
  });
  const key = 'a'.repeat(16);
  assert.equal(parseIdempotencyKeyHeader(key), key);
});
