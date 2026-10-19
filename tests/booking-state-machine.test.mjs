import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertBookingMutable,
  assertBookingTransition,
  BookingStateTransitionError,
  BookingTerminalImmutableError,
  BOOKING_STATUS_TRANSITIONS,
  canTransitionBooking,
  isBookingStatus,
  isInProgressBookingStatus,
  isTerminalBookingStatus,
} from '@railflux/shared';

test('isBookingStatus recognizes OpenAPI enum values', () => {
  assert.equal(isBookingStatus('RECEIVED'), true);
  assert.equal(isBookingStatus('CONFIRMED'), true);
  assert.equal(isBookingStatus('PENDING'), false);
});

test('terminal and in-progress helpers', () => {
  assert.equal(isTerminalBookingStatus('CONFIRMED'), true);
  assert.equal(isTerminalBookingStatus('SOLD_OUT'), true);
  assert.equal(isTerminalBookingStatus('FAILED'), true);
  assert.equal(isTerminalBookingStatus('RECEIVED'), false);
  assert.equal(isInProgressBookingStatus('PAYMENT_PENDING'), true);
  assert.equal(isInProgressBookingStatus('CONFIRMED'), false);
});

test('legal transitions from data-consistency state diagram', () => {
  const legal = [
    ['RECEIVED', 'SOLD_OUT'],
    ['RECEIVED', 'PAYMENT_PENDING'],
    ['PAYMENT_PENDING', 'FAILED'],
    ['PAYMENT_PENDING', 'CONFIRMED'],
  ];
  for (const [from, to] of legal) {
    assert.equal(canTransitionBooking(from, to), true, `${from} -> ${to}`);
    assert.doesNotThrow(() => assertBookingTransition(from, to));
  }
});

test('illegal transitions are rejected', () => {
  const illegal = [
    ['RECEIVED', 'CONFIRMED'],
    ['RECEIVED', 'FAILED'],
    ['PAYMENT_PENDING', 'SOLD_OUT'],
    ['PAYMENT_PENDING', 'RECEIVED'],
    ['CONFIRMED', 'FAILED'],
    ['SOLD_OUT', 'RECEIVED'],
    ['FAILED', 'CONFIRMED'],
  ];
  for (const [from, to] of illegal) {
    assert.equal(canTransitionBooking(from, to), false, `${from} -> ${to}`);
    assert.throws(() => assertBookingTransition(from, to), BookingStateTransitionError);
  }
});

test('terminal states are immutable', () => {
  for (const terminal of ['CONFIRMED', 'SOLD_OUT', 'FAILED']) {
    assert.throws(() => assertBookingMutable(terminal), BookingTerminalImmutableError);
    assert.throws(() => assertBookingTransition(terminal, terminal), BookingTerminalImmutableError);
    assert.equal(canTransitionBooking(terminal, 'RECEIVED'), false);
  }
});

test('in-progress no-op transition is allowed', () => {
  assert.equal(canTransitionBooking('RECEIVED', 'RECEIVED'), true);
  assert.doesNotThrow(() => assertBookingTransition('PAYMENT_PENDING', 'PAYMENT_PENDING'));
});

test('transition table has no outbound edges from terminal states', () => {
  for (const terminal of ['CONFIRMED', 'SOLD_OUT', 'FAILED']) {
    assert.deepEqual(BOOKING_STATUS_TRANSITIONS[terminal], []);
  }
});
