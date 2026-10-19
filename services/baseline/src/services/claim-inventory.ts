import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { DbPool } from '../db.js';

export type ClaimInventoryInput = {
  inventoryId: string;
  seatCount: number;
  expectedVersion: number;
};

export type ClaimInventorySuccess = {
  ok: true;
  inventoryId: string;
  seatCount: number;
  availableSeats: number;
  version: number;
};

export type ClaimInventoryFailureReason = 'SOLD_OUT' | 'NOT_FOUND' | 'VERSION_CONFLICT';

export type ClaimInventoryFailure = {
  ok: false;
  reason: ClaimInventoryFailureReason;
};

export type ClaimInventoryResult = ClaimInventorySuccess | ClaimInventoryFailure;

type DbExecutor = DbPool | PoolConnection;

interface InventoryRow extends RowDataPacket {
  availableSeats: number;
  version: number;
}

function validateSeatCount(seatCount: number): void {
  if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 4) {
    throw new Error('seatCount must be an integer from 1 to 4');
  }
}

/**
 * Atomically decrement inventory when enough seats exist and version matches (optimistic lock).
 * Zero updated rows → sold out, stale version, or missing bucket (see reason).
 */
export async function claimInventorySeats(
  db: DbExecutor,
  input: ClaimInventoryInput,
): Promise<ClaimInventoryResult> {
  validateSeatCount(input.seatCount);
  const { inventoryId, seatCount, expectedVersion } = input;

  const [updateResult] = await db.query<ResultSetHeader>(
    `UPDATE seat_inventory
     SET available_seats = available_seats - ?,
         version = version + 1
     WHERE id = ?
       AND version = ?
       AND available_seats >= ?`,
    [seatCount, inventoryId, expectedVersion, seatCount],
  );

  if (updateResult.affectedRows === 1) {
    const [rows] = await db.query<InventoryRow[]>(
      `SELECT available_seats AS availableSeats, version
       FROM seat_inventory
       WHERE id = ?`,
      [inventoryId],
    );
    const row = rows[0];
    if (!row) {
      return { ok: false, reason: 'NOT_FOUND' };
    }
    return {
      ok: true,
      inventoryId,
      seatCount,
      availableSeats: row.availableSeats,
      version: row.version,
    };
  }

  const [rows] = await db.query<InventoryRow[]>(
    `SELECT available_seats AS availableSeats, version
     FROM seat_inventory
     WHERE id = ?`,
    [inventoryId],
  );
  const row = rows[0];
  if (!row) {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  if (row.version !== expectedVersion) {
    return { ok: false, reason: 'VERSION_CONFLICT' };
  }
  return { ok: false, reason: 'SOLD_OUT' };
}
