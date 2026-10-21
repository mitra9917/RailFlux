import {
  BASELINE_BOOKING_CONFIRMED_HANDLER,
  BOOKING_CONFIRMED_EVENT_TYPE,
  type BookingConfirmedOutboxMessage,
} from '@railflux/shared';
import type { RowDataPacket } from 'mysql2/promise';
import type { DbPool } from '../db.js';

export type ProcessSideEffectResult =
  | { ok: true; processed: true; handlerType: string }
  | { ok: true; processed: false; handlerType: string; reason: 'ALREADY_PROCESSED' }
  | { ok: false; reason: 'INVALID_MESSAGE' | 'OUTBOX_NOT_FOUND' };

export function parseBookingConfirmedQueueMessage(
  body: string,
): BookingConfirmedOutboxMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const msg = parsed as Partial<BookingConfirmedOutboxMessage>;
  if (msg.schemaVersion !== 1) return null;
  if (msg.eventType !== BOOKING_CONFIRMED_EVENT_TYPE) return null;
  if (typeof msg.eventId !== 'string' || typeof msg.bookingId !== 'string') return null;
  if (typeof msg.runId !== 'string' || typeof msg.occurredAt !== 'string') return null;
  if (!msg.payload || typeof msg.payload.notificationTarget !== 'string') return null;
  return msg as BookingConfirmedOutboxMessage;
}

/** Idempotent worker handler for at-least-once SQS delivery (TC-010). */
export async function processBookingConfirmedSideEffectMessage(
  pool: DbPool,
  message: BookingConfirmedOutboxMessage,
  handlerType: string = BASELINE_BOOKING_CONFIRMED_HANDLER,
): Promise<ProcessSideEffectResult> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [outboxRows] = await conn.query<RowDataPacket[]>(
      `SELECT 1 FROM outbox_events WHERE event_id = ? AND event_type = ? LIMIT 1`,
      [message.eventId, BOOKING_CONFIRMED_EVENT_TYPE],
    );
    if (outboxRows.length === 0) {
      await conn.rollback();
      return { ok: false, reason: 'OUTBOX_NOT_FOUND' };
    }

    const [existing] = await conn.query<RowDataPacket[]>(
      `SELECT 1 FROM processed_events WHERE event_id = ? AND handler_type = ?`,
      [message.eventId, handlerType],
    );
    if (existing.length > 0) {
      await conn.commit();
      return { ok: true, processed: false, handlerType, reason: 'ALREADY_PROCESSED' };
    }

    runSyntheticBookingConfirmedHandler(message, handlerType);

    try {
      await conn.query(
        `INSERT INTO processed_events (event_id, run_id, handler_type)
         VALUES (?, ?, ?)`,
        [message.eventId, message.runId, handlerType],
      );
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'ER_DUP_ENTRY') {
        await conn.commit();
        return { ok: true, processed: false, handlerType, reason: 'ALREADY_PROCESSED' };
      }
      throw err;
    }

    await conn.commit();
    return { ok: true, processed: true, handlerType };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function runSyntheticBookingConfirmedHandler(
  _message: BookingConfirmedOutboxMessage,
  _handlerType: string,
): void {
  // Placeholder side effect (no external I/O); dedupe via processed_events.
}
