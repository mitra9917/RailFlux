import mysql from 'mysql2/promise';
import type { ServiceConfig } from './config.js';

export type DbPool = mysql.Pool;

export function createPool(config: ServiceConfig): DbPool {
  return mysql.createPool({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60_000,
  });
}

export async function pingDatabase(pool: DbPool): Promise<boolean> {
  try {
    const conn = await pool.getConnection();
    try {
      await conn.ping();
      return true;
    } finally {
      conn.release();
    }
  } catch {
    return false;
  }
}
