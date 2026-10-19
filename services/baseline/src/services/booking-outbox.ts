import {
  BASELINE_BOOKING_CONFIRMED_HANDLER,
  BOOKING_AGGREGATE_TYPE,
  BOOKING_CONFIRMED_EVENT_TYPE,
  buildBookingConfirmedOutboxMessage,
  type BookingConfirmedOutboxMessage,
} from '@railflux/shared';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

export type InsertBookingConfirmedOutboxInput = {
  eventId: string;
  bookingId: string;
  runId: string;
  userId: string;
  occurredAt?: Date;
};

export type ProcessBookingOutboxSyncInput = {
  eventId: string;
  runId: string;
  handlerType?: string;
};

export type ProcessBookingOutboxSyncResult =
  | { ok: true; processed: true; handlerType: string }
  | { ok: true; processed: false; handlerType: string; reason: 'ALREADY_PROCESSED' }
  | { ok: false; reason: 'OUTBOX_NOT_FOUND' | 'INVALID_EVENT_TYPE' };

interface OutboxRow extends RowDataPacket {
  eventType: string;
  payload: BookingConfirmedOutboxMessage;
  publishedAt: Date | null;
}

/** Durable outbox row in the same transaction as booking confirmation. */
export async function insertBookingConfirmedOutboxEvent(
  conn: PoolConnection,
  input: InsertBookingConfirmedOutboxInput,
): Promise<BookingConfirmedOutboxMessage> {
  const occurredAt = input.occurredAt ?? new Date();
  const message = buildBookingConfirmedOutboxMessage({
    eventId: input.eventId,
    bookingId: input.bookingId,
    runId: input.runId,
    userId: input.userId,
    occurredAt,
  });

  await conn.query(
    `INSERT INTO outbox_events (event_id, aggregate_type, aggregate_id, event_type, payload, published_at)
     VALUES (?, ?, ?, ?, CAST(? AS JSON), NULL)`,
    [
      input.eventId,
      BOOKING_AGGREGATE_TYPE,
      input.bookingId,
      BOOKING_CONFIRMED_EVENT_TYPE,
      JSON.stringify(message),
    ],
  );

  return message;
}

/** Baseline: run side effect inline and record dedupe + published_at (no SQS). */
export async function processBookingConfirmedOutboxSynchronously(
  conn: PoolConnection,
  input: ProcessBookingOutboxSyncInput,
): Promise<ProcessBookingOutboxSyncResult> {
  const handlerType = input.handlerType ?? BASELINE_BOOKING_CONFIRMED_HANDLER;

  const [rows] = await conn.query<OutboxRow[]>(
    `SELECT event_type AS eventType,
            payload,
            published_at AS publishedAt
     FROM outbox_events
     WHERE event_id = ?
     FOR UPDATE`,
    [input.eventId],
  );
  const row = rows[0];
  if (!row) {
    return { ok: false, reason: 'OUTBOX_NOT_FOUND' };
  }
  if (row.eventType !== BOOKING_CONFIRMED_EVENT_TYPE) {
    return { ok: false, reason: 'INVALID_EVENT_TYPE' };
  }

  const [existing] = await conn.query<RowDataPacket[]>(
    `SELECT 1 FROM processed_events WHERE event_id = ? AND handler_type = ?`,
    [input.eventId, handlerType],
  );
  if (existing.length > 0) {
    if (row.publishedAt === null) {
      await conn.query(
        `UPDATE outbox_events SET published_at = CURRENT_TIMESTAMP(6) WHERE event_id = ?`,
        [input.eventId],
      );
    }
    return { ok: true, processed: false, handlerType, reason: 'ALREADY_PROCESSED' };
  }

  runSyntheticBookingConfirmedHandler(row.payload, handlerType);

  try {
    await conn.query(
      `INSERT INTO processed_events (event_id, run_id, handler_type)
       VALUES (?, ?, ?)`,
      [input.eventId, input.runId, handlerType],
    );
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'ER_DUP_ENTRY') {
      return { ok: true, processed: false, handlerType, reason: 'ALREADY_PROCESSED' };
    }
    throw err;
  }

  await conn.query(
    `UPDATE outbox_events SET published_at = CURRENT_TIMESTAMP(6) WHERE event_id = ?`,
    [input.eventId],
  );

  return { ok: true, processed: true, handlerType };
}

/** Placeholder side effect (no external I/O); idempotency is enforced via processed_events. */
function runSyntheticBookingConfirmedHandler(
  _message: BookingConfirmedOutboxMessage,
  _handlerType: string,
): void {
  // Intentionally empty for baseline MVP.
}
