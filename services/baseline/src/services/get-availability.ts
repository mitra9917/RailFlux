import { notFound, type AvailabilityQuery, type Availability } from '@railflux/shared';
import type { RowDataPacket } from 'mysql2/promise';
import type { DbPool } from '../db.js';
import { baselineReadFreshness } from '../freshness.js';

interface InventoryRow extends RowDataPacket {
  trainRunId: string;
  classCode: string;
  quota: string;
  availableSeats: number;
}

export async function getAvailability(
  pool: DbPool,
  query: AvailabilityQuery,
): Promise<Availability> {
  const [rows] = await pool.query<InventoryRow[]>(
    `SELECT si.train_run_id AS trainRunId,
            si.class_code AS classCode,
            si.quota,
            si.available_seats AS availableSeats
     FROM seat_inventory si
     INNER JOIN train_runs tr ON tr.id = si.train_run_id
     WHERE si.train_run_id = ? AND si.class_code = ? AND si.quota = ?
     LIMIT 1`,
    [query.trainRunId, query.class, query.quota],
  );

  const row = rows[0];
  if (!row) {
    throw notFound();
  }

  return {
    trainRunId: row.trainRunId,
    class: query.class,
    quota: query.quota,
    displayedSeats: row.availableSeats,
    freshness: baselineReadFreshness(),
  };
}
