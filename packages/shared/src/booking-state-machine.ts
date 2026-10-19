import type { BookingInProgressStatus, BookingStatus } from './api-types.js';

/** Matches docs/design/data-consistency.md booking state diagram. */
export const BOOKING_STATUS_TRANSITIONS: Readonly<
  Record<BookingStatus, readonly BookingStatus[]>
> = {
  RECEIVED: ['SOLD_OUT', 'PAYMENT_PENDING'],
  PAYMENT_PENDING: ['FAILED', 'CONFIRMED'],
  CONFIRMED: [],
  SOLD_OUT: [],
  FAILED: [],
};

export const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = [
  'CONFIRMED',
  'SOLD_OUT',
  'FAILED',
];

export const IN_PROGRESS_BOOKING_STATUSES: readonly BookingInProgressStatus[] = [
  'RECEIVED',
  'PAYMENT_PENDING',
];

const ALL_BOOKING_STATUSES: readonly BookingStatus[] = [
  'RECEIVED',
  'PAYMENT_PENDING',
  'CONFIRMED',
  'SOLD_OUT',
  'FAILED',
];

export class BookingStateTransitionError extends Error {
  readonly from: BookingStatus;
  readonly to: BookingStatus;

  constructor(from: BookingStatus, to: BookingStatus) {
    super(`Illegal booking status transition: ${from} -> ${to}`);
    this.name = 'BookingStateTransitionError';
    this.from = from;
    this.to = to;
  }
}

export class BookingTerminalImmutableError extends Error {
  readonly status: BookingStatus;

  constructor(status: BookingStatus) {
    super(`Booking status ${status} is terminal and cannot change`);
    this.name = 'BookingTerminalImmutableError';
    this.status = status;
  }
}

export function isBookingStatus(value: unknown): value is BookingStatus {
  return typeof value === 'string' && (ALL_BOOKING_STATUSES as readonly string[]).includes(value);
}

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return (TERMINAL_BOOKING_STATUSES as readonly string[]).includes(status);
}

export function isInProgressBookingStatus(status: BookingStatus): status is BookingInProgressStatus {
  return (IN_PROGRESS_BOOKING_STATUSES as readonly string[]).includes(status);
}

/** Whether `to` is allowed from `from` (including no-op when equal and not terminal). */
export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  if (from === to) {
    return !isTerminalBookingStatus(from);
  }
  if (isTerminalBookingStatus(from)) {
    return false;
  }
  return BOOKING_STATUS_TRANSITIONS[from].includes(to);
}

export function assertBookingTransition(from: BookingStatus, to: BookingStatus): void {
  if (from === to) {
    if (isTerminalBookingStatus(from)) {
      throw new BookingTerminalImmutableError(from);
    }
    return;
  }
  if (!canTransitionBooking(from, to)) {
    throw new BookingStateTransitionError(from, to);
  }
}

/** Reject mutations on terminal bookings (status or related rows). */
export function assertBookingMutable(status: BookingStatus): void {
  if (isTerminalBookingStatus(status)) {
    throw new BookingTerminalImmutableError(status);
  }
}
