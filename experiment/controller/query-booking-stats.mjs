/**
 * Post-run booking/payment counts from MySQL for result.schema.json (M6 #60).
 */

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {string} runId
 */
export async function queryBookingStats(pool, runId) {
  const [statusRows] = await pool.query(
    `SELECT status, COUNT(*) AS c FROM bookings WHERE run_id = ? GROUP BY status`,
    [runId],
  );
  /** @type {Record<string, number>} */
  const byStatus = {};
  for (const row of statusRows) {
    byStatus[String(row.status)] = Number(row.c);
  }

  const [dupRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM (
       SELECT booking_id FROM payments
       WHERE run_id = ? AND status = 'SUCCESS'
       GROUP BY booking_id HAVING COUNT(*) > 1
     ) t`,
    [runId],
  );
  const duplicateCharges = Number(dupRows[0]?.c ?? 0);

  const [oversellRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM seat_inventory si
     WHERE si.available_seats < 0
       AND EXISTS (SELECT 1 FROM bookings b WHERE b.run_id = ? AND b.fixture_id = si.fixture_id LIMIT 1)`,
    [runId],
  );
  const oversells = Number(oversellRows[0]?.c ?? 0);

  return {
    confirmed_unique: byStatus.CONFIRMED ?? 0,
    sold_out: byStatus.SOLD_OUT ?? 0,
    technical_failures: byStatus.FAILED ?? 0,
    timeouts_unknown: byStatus.TIMEOUT ?? byStatus.UNKNOWN ?? 0,
    oversells,
    duplicate_charges: duplicateCharges,
  };
}

export async function createMysqlPoolFromEnv() {
  const mysql = await import('mysql2/promise');
  return mysql.createPool({
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? '3307'),
    user: process.env.MYSQL_USER ?? 'railflux',
    password: process.env.MYSQL_PASSWORD ?? 'railflux',
    database: process.env.MYSQL_DATABASE ?? 'railflux',
    waitForConnections: true,
    connectionLimit: 2,
  });
}
