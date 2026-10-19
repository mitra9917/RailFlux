import type { BookingResult } from '@railflux/shared';
import { RailFluxError } from '@railflux/shared';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { DbPool } from '../db.js';

export const IDEMPOTENCY_STATUS_IN_PROGRESS = 'IN_PROGRESS';
export const IDEMPOTENCY_STATUS_COMPLETED = 'COMPLETED';

/** Default idempotency record TTL (exceeds client retry window). */
export const DEFAULT_IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type DbExecutor = DbPool | PoolConnection;

interface IdempotencyRow extends RowDataPacket {
  idempotencyKeyHash: string;
  runId: string;
  requestHash: string;
  status: string;
  bookingId: string | null;
  responseBody: unknown;
  expiresAt: Date;
}

export type IdempotencyReplayResult = {
  type: 'replay';
  body: BookingResult;
};

export type IdempotencyResolveResult =
  | IdempotencyReplayResult
  | { type: 'not_found' }
  | { type: 'conflict' }
  | { type: 'in_progress' };

function parseStoredBookingResult(value: unknown): BookingResult {
  if (!value || typeof value !== 'object') {
    throw new Error('Corrupt idempotency response_body');
  }
  const row = value as Record<string, unknown>;
  if (typeof row.bookingId !== 'string' || typeof row.status !== 'string') {
    throw new Error('Corrupt idempotency response_body');
  }
  return row as BookingResult;
}

export async function getIdempotencyRecord(
  db: DbExecutor,
  idempotencyKeyHash: string,
): Promise<IdempotencyRow | null> {
  const [rows] = await db.query<IdempotencyRow[]>(
    `SELECT idempotency_key_hash AS idempotencyKeyHash,
            run_id AS runId,
            request_hash AS requestHash,
            status,
            booking_id AS bookingId,
            response_body AS responseBody,
            expires_at AS expiresAt
     FROM booking_idempotency
     WHERE idempotency_key_hash = ?`,
    [idempotencyKeyHash],
  );
  return rows[0] ?? null;
}

export async function insertIdempotencyInProgress(
  db: DbExecutor,
  input: {
    idempotencyKeyHash: string;
    runId: string;
    requestHash: string;
    expiresAt: Date;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO booking_idempotency
       (idempotency_key_hash, run_id, request_hash, status, booking_id, response_body, expires_at)
     VALUES (?, ?, ?, ?, NULL, NULL, ?)`,
    [
      input.idempotencyKeyHash,
      input.runId,
      input.requestHash,
      IDEMPOTENCY_STATUS_IN_PROGRESS,
      input.expiresAt,
    ],
  );
}

export async function completeIdempotencyTerminal(
  db: DbExecutor,
  input: {
    idempotencyKeyHash: string;
    bookingId: string;
    responseBody: BookingResult;
  },
): Promise<void> {
  await db.query(
    `UPDATE booking_idempotency
     SET status = ?,
         booking_id = ?,
         response_body = ?
     WHERE idempotency_key_hash = ?`,
    [
      IDEMPOTENCY_STATUS_COMPLETED,
      input.bookingId,
      JSON.stringify(input.responseBody),
      input.idempotencyKeyHash,
    ],
  );
}

/** TC-005: same key + same request hash returns stored terminal `BookingResult`. */
export async function resolveIdempotencyReplay(
  db: DbExecutor,
  input: { idempotencyKeyHash: string; requestHash: string },
): Promise<IdempotencyResolveResult> {
  const record = await getIdempotencyRecord(db, input.idempotencyKeyHash);
  if (!record) {
    return { type: 'not_found' };
  }
  if (record.requestHash !== input.requestHash) {
    return { type: 'conflict' };
  }
  if (record.status === IDEMPOTENCY_STATUS_COMPLETED && record.responseBody != null) {
    return { type: 'replay', body: parseStoredBookingResult(record.responseBody) };
  }
  if (record.status === IDEMPOTENCY_STATUS_IN_PROGRESS) {
    return { type: 'in_progress' };
  }
  return { type: 'not_found' };
}

export function idempotencyConflictError(): RailFluxError {
  return new RailFluxError('IDEMPOTENCY_CONFLICT', 'Idempotency-Key reused with a different request', 409);
}

export function idempotencyExpiresAt(fromMs: number = Date.now()): Date {
  return new Date(fromMs + DEFAULT_IDEMPOTENCY_TTL_MS);
}
