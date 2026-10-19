import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BOOKING_CONFIRMED_EVENT_TYPE,
  buildBookingConfirmedOutboxMessage,
} from '@railflux/shared';

test('buildBookingConfirmedOutboxMessage matches queue contract shape', () => {
  const occurredAt = new Date('2026-04-01T12:00:00.000Z');
  const message = buildBookingConfirmedOutboxMessage({
    eventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    bookingId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    runId: 'run-1',
    userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    occurredAt,
  });
  assert.equal(message.schemaVersion, 1);
  assert.equal(message.eventType, BOOKING_CONFIRMED_EVENT_TYPE);
  assert.equal(message.occurredAt, occurredAt.toISOString());
  assert.deepEqual(message.payload, {
    notificationTarget: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  });
});
