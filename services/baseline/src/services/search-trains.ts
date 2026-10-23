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
  const filters = ['tr.journey_date = ?'];
  const params: Array<string> = [query.date];
  if (query.from) {
    filters.push('t.source = ?');
    params.push(query.from);
  }
  if (query.to) {
    filters.push('t.destination = ?');
    params.push(query.to);
  }

  const [rows] = await pool.query<SearchRow[]>(
    `SELECT tr.id AS trainRunId,
            t.train_no AS trainNo,
            t.name,
            DATE_FORMAT(tr.journey_date, '%Y-%m-%d') AS journeyDate,
            t.source,
            t.destination
     FROM train_runs tr
     INNER JOIN trains t ON t.train_no = tr.train_no
     WHERE ${filters.join(' AND ')}
     ORDER BY t.train_no`,
    params,
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
