import type { SearchTrainsQuery, TrainRun } from '@railflux/shared';
import type { RowDataPacket } from 'mysql2/promise';
import type { DbPool } from '../db.js';

interface SearchRow extends RowDataPacket {
  trainRunId: string;
  trainNo: string;
  name: string;
  journeyDate: string;
  source: string;
  destination: string;
}

export async function searchTrains(pool: DbPool, query: SearchTrainsQuery): Promise<TrainRun[]> {
  const [rows] = await pool.query<SearchRow[]>(
    `SELECT tr.id AS trainRunId,
            t.train_no AS trainNo,
            t.name,
            DATE_FORMAT(tr.journey_date, '%Y-%m-%d') AS journeyDate,
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
    date: row.journeyDate,
    from: row.source,
    to: row.destination,
  }));
}
