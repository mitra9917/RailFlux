import {
  type BookingResult,
  type BookingResultErrorCode,
  type BookingStatus,
  isBookingStatus,
  RailFluxError,
} from '@railflux/shared';
import type { RowDataPacket } from 'mysql2/promise';
import type { DbPool } from '../db.js';

interface BookingRow extends RowDataPacket {
  id: string;
  status: string;
  simulatedPnr: string | null;
}

function terminalErrorCode(status: BookingStatus): BookingResultErrorCode | null {
  if (status === 'SOLD_OUT') return 'SOLD_OUT';
  if (status === 'FAILED') return 'PAYMENT_FAILED';
  return null;
}

function toBookingResult(row: BookingRow): BookingResult {
  if (!isBookingStatus(row.status)) {
    throw new RailFluxError('INTERNAL_ERROR', 'Unknown booking status in database', 500);
  }
  return {
    bookingId: row.id,
    simulatedPnr: row.simulatedPnr,
    status: row.status,
    errorCode: terminalErrorCode(row.status),
  };
}

/** TC-009 / FT-008: read committed booking state after client timeout on POST. */
export async function getBookingResult(db: DbPool, bookingId: string): Promise<BookingResult | null> {
  const [rows] = await db.query<BookingRow[]>(
    `SELECT id, status, simulated_pnr AS simulatedPnr
     FROM bookings
     WHERE id = ?
     LIMIT 1`,
    [bookingId],
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return toBookingResult(row);
}
