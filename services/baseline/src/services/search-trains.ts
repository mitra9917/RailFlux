import type { SearchTrainsQuery, TrainRun } from '@railflux/shared';
import type { RowDataPacket } from 'mysql2/promise';
import type { DbPool } from '../db.js';

interface SearchRow extends RowDataPacket {
  trainRunId: string;
  trainNo: string;
  name: string;
  journeyDate: Date | string;
  source: string;
  destination: string;
}

function formatJourneyDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

export async function searchTrains(pool: DbPool, query: SearchTrainsQuery): Promise<TrainRun[]> {
  const [rows] = await pool.query<SearchRow[]>(
    `SELECT tr.id AS trainRunId,
            t.train_no AS trainNo,
            t.name,
            tr.journey_date AS journeyDate,
            t.source,
            t.destination
     FROM train_runs tr
     INNER JOIN trains t ON t.train_no = tr.train_no
     WHERE t.source = ? AND t.destination = ? AND tr.journey_date = ?
     ORDER BY t.train_no`,
    [query.from, query.to, query.date],
  );

  return rows.map((row) => ({
    trainRunId: row.trainRunId,
    trainNo: row.trainNo,
    name: row.name,
    date: formatJourneyDate(row.journeyDate),
    from: row.source,
    to: row.destination,
  }));
}
