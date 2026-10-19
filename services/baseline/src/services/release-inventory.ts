import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { DbPool } from '../db.js';
import type { PoolConnection } from 'mysql2/promise';

export type ReleaseInventoryInput = {
  inventoryId: string;
  seatCount: number;
  expectedVersion: number;
};

export type ReleaseInventorySuccess = {
  ok: true;
  inventoryId: string;
  seatCount: number;
  availableSeats: number;
  version: number;
};

export type ReleaseInventoryFailureReason = 'NOT_FOUND' | 'VERSION_CONFLICT';

export type ReleaseInventoryFailure = {
  ok: false;
  reason: ReleaseInventoryFailureReason;
};

export type ReleaseInventoryResult = ReleaseInventorySuccess | ReleaseInventoryFailure;

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
 * Return claimed seats to inventory when version matches (inverse of claim).
 * A second release with a stale version yields VERSION_CONFLICT (exactly-once release).
 */
export async function releaseInventorySeats(
  db: DbExecutor,
  input: ReleaseInventoryInput,
): Promise<ReleaseInventoryResult> {
  validateSeatCount(input.seatCount);
  const { inventoryId, seatCount, expectedVersion } = input;

  const [updateResult] = await db.query<ResultSetHeader>(
    `UPDATE seat_inventory
     SET available_seats = available_seats + ?,
         version = version + 1
     WHERE id = ?
       AND version = ?`,
    [seatCount, inventoryId, expectedVersion],
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
  return { ok: false, reason: 'VERSION_CONFLICT' };
}
