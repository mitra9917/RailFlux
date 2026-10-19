import { assertBookingTransition, type BookingStatus } from '@railflux/shared';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { releaseInventorySeats } from './release-inventory.js';

export type FinalizePaymentFailureInput = {
  bookingId: string;
  inventoryId: string;
  seatCount: number;
  /** Inventory `version` after the successful claim (before release). */
  inventoryVersionAfterClaim: number;
  paymentId: string;
};

export type FinalizePaymentFailureSuccess = {
  ok: true;
  released: boolean;
  bookingStatus: 'FAILED';
  availableSeats: number;
  inventoryVersion: number;
};

export type FinalizePaymentFailureFailure = {
  ok: false;
  reason: 'BOOKING_NOT_FOUND' | 'PAYMENT_NOT_FOUND' | 'INVALID_STATUS' | 'RELEASE_CONFLICT';
};

export type FinalizePaymentFailureResult =
  | FinalizePaymentFailureSuccess
  | FinalizePaymentFailureFailure;

interface BookingRow extends RowDataPacket {
  status: BookingStatus;
  inventoryId: string;
  seatCount: number;
}

interface PaymentRow extends RowDataPacket {
  status: string;
}

/**
 * Terminalize a booking after payment authorization failed and release inventory exactly once.
 * Idempotent when the booking is already `FAILED` (no inventory mutation).
 */
export async function finalizeBookingAfterPaymentFailure(
  conn: PoolConnection,
  input: FinalizePaymentFailureInput,
): Promise<FinalizePaymentFailureResult> {
  const [bookingRows] = await conn.query<BookingRow[]>(
    `SELECT status, inventory_id AS inventoryId, seat_count AS seatCount
     FROM bookings
     WHERE id = ?
     FOR UPDATE`,
    [input.bookingId],
  );
  const booking = bookingRows[0];
  if (!booking) {
    return { ok: false, reason: 'BOOKING_NOT_FOUND' };
  }

  if (booking.status === 'FAILED') {
    const [invRows] = await conn.query<RowDataPacket[]>(
      `SELECT available_seats AS availableSeats, version
       FROM seat_inventory WHERE id = ?`,
      [input.inventoryId],
    );
    const inv = invRows[0] as { availableSeats: number; version: number } | undefined;
    if (!inv) {
      return { ok: false, reason: 'RELEASE_CONFLICT' };
    }
    return {
      ok: true,
      released: false,
      bookingStatus: 'FAILED',
      availableSeats: inv.availableSeats,
      inventoryVersion: inv.version,
    };
  }

  if (booking.status !== 'PAYMENT_PENDING') {
    return { ok: false, reason: 'INVALID_STATUS' };
  }

  if (
    booking.inventoryId !== input.inventoryId ||
    booking.seatCount !== input.seatCount
  ) {
    return { ok: false, reason: 'INVALID_STATUS' };
  }

  const [paymentRows] = await conn.query<PaymentRow[]>(
    `SELECT status FROM payments WHERE id = ? AND booking_id = ? FOR UPDATE`,
    [input.paymentId, input.bookingId],
  );
  if (!paymentRows[0]) {
    return { ok: false, reason: 'PAYMENT_NOT_FOUND' };
  }

  assertBookingTransition('PAYMENT_PENDING', 'FAILED');

  const release = await releaseInventorySeats(conn, {
    inventoryId: input.inventoryId,
    seatCount: input.seatCount,
    expectedVersion: input.inventoryVersionAfterClaim,
  });
  if (!release.ok) {
    return { ok: false, reason: 'RELEASE_CONFLICT' };
  }

  await conn.query(`UPDATE bookings SET status = 'FAILED' WHERE id = ?`, [input.bookingId]);
  await conn.query(`UPDATE payments SET status = 'FAILED' WHERE id = ?`, [input.paymentId]);

  return {
    ok: true,
    released: true,
    bookingStatus: 'FAILED',
    availableSeats: release.availableSeats,
    inventoryVersion: release.version,
  };
}
