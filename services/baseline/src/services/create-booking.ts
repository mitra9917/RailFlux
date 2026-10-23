import { randomUUID } from 'node:crypto';
import type { BookingResult, CreateBookingRequest } from '@railflux/shared';
import {
  RailFluxError,
  assertBookingTransition,
  generateSimulatedPnr,
  paymentOutcomeOverride,
} from '@railflux/shared';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { DbPool } from '../db.js';
import { claimInventorySeats } from './claim-inventory.js';
import {
  completeIdempotencyTerminal,
  idempotencyExpiresAt,
  insertIdempotencyInProgress,
  attachIdempotencyBookingId,
} from './booking-idempotency.js';
import { getOutboxDeliveryMode } from '../outbox-delivery.js';
import {
  insertBookingConfirmedOutboxEvent,
  processBookingConfirmedOutboxSynchronously,
} from './booking-outbox.js';
import {
  createSideEffectsSqsClient,
  loadSideEffectsSqsConfig,
  publishBookingConfirmedOutboxToSqs,
} from './outbox-sqs-publisher.js';
import { finalizeBookingAfterPaymentFailure } from './payment-failure-release.js';
import { getPaymentStubRunSequence } from './payment-stub.js';

export type CreateBookingInput = {
  runId: string;
  idempotencyKeyHash: string;
  requestHash: string;
  body: CreateBookingRequest;
  skipPaymentDelay?: boolean;
};

export type CreateBookingHttpResult =
  | { kind: 'created'; status: 201; body: BookingResult }
  | { kind: 'sold_out'; status: 409; body: BookingResult; error: RailFluxError }
  | { kind: 'payment_failed'; status: 422; body: BookingResult }
  | { kind: 'in_progress'; status: 425 };

interface InventoryRow extends RowDataPacket {
  version: number;
}

function bookingResult(bookingId: string, status: BookingResult['status'], simulatedPnr: string | null): BookingResult {
  const errorCode =
    status === 'SOLD_OUT' ? 'SOLD_OUT' : status === 'FAILED' ? 'PAYMENT_FAILED' : null;
  return { bookingId, status, simulatedPnr, errorCode };
}

function defaultFare(seatCount: number): number {
  return 100 * seatCount;
}

async function insertPassengers(
  conn: PoolConnection,
  bookingId: string,
  body: CreateBookingRequest,
): Promise<void> {
  for (const passenger of body.passengers) {
    await conn.query(
      `INSERT INTO booking_passengers (id, booking_id, synthetic_name, age)
       VALUES (?, ?, ?, ?)`,
      [randomUUID(), bookingId, passenger.syntheticName, passenger.age],
    );
  }
}

function isDeadlockError(err: unknown): boolean {
  return (err as { code?: string }).code === 'ER_LOCK_DEADLOCK';
}

const CREATE_BOOKING_DEADLOCK_RETRIES = 8;

async function createBookingAttempt(
  pool: DbPool,
  input: CreateBookingInput,
): Promise<CreateBookingHttpResult> {
  const seatCount = input.body.passengers.length;
  const conn = await pool.getConnection();
  let outboxEventId: string | null = null;
  let successTerminal: BookingResult | null = null;

  try {
    await conn.beginTransaction();

    const [invRows] = await conn.query<InventoryRow[]>(
      `SELECT version FROM seat_inventory WHERE id = ? FOR UPDATE`,
      [input.body.inventoryId],
    );
    const inv = invRows[0];
    if (!inv) {
      throw new RailFluxError('NOT_FOUND', 'Inventory bucket not found', 404);
    }

    try {
      await insertIdempotencyInProgress(conn, {
        idempotencyKeyHash: input.idempotencyKeyHash,
        runId: input.runId,
        requestHash: input.requestHash,
        expiresAt: idempotencyExpiresAt(),
      });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'ER_DUP_ENTRY') {
        await conn.rollback();
        return { kind: 'in_progress', status: 425 };
      }
      throw err;
    }

    const bookingId = randomUUID();
    await conn.query(
      `INSERT INTO bookings (id, run_id, user_id, inventory_id, status, seat_count, total_fare)
       VALUES (?, ?, ?, ?, 'RECEIVED', ?, ?)`,
      [
        bookingId,
        input.runId,
        input.body.userId,
        input.body.inventoryId,
        seatCount,
        defaultFare(seatCount),
      ],
    );
    await attachIdempotencyBookingId(conn, input.idempotencyKeyHash, bookingId);
    await insertPassengers(conn, bookingId, input.body);

    const claim = await claimInventorySeats(conn, {
      inventoryId: input.body.inventoryId,
      seatCount,
      expectedVersion: inv.version,
    });

    if (!claim.ok) {
      if (claim.reason === 'NOT_FOUND') {
        throw new RailFluxError('NOT_FOUND', 'Inventory bucket not found', 404);
      }
      assertBookingTransition('RECEIVED', 'SOLD_OUT');
      await conn.query(`UPDATE bookings SET status = 'SOLD_OUT' WHERE id = ?`, [bookingId]);
      const terminal = bookingResult(bookingId, 'SOLD_OUT', null);
      await completeIdempotencyTerminal(conn, {
        idempotencyKeyHash: input.idempotencyKeyHash,
        bookingId,
        responseBody: terminal,
      });
      await conn.commit();
      return {
        kind: 'sold_out',
        status: 409,
        body: terminal,
        error: new RailFluxError('SOLD_OUT', 'No seats available', 409),
      };
    }

    assertBookingTransition('RECEIVED', 'PAYMENT_PENDING');
    await conn.query(`UPDATE bookings SET status = 'PAYMENT_PENDING' WHERE id = ?`, [bookingId]);

    const paymentId = randomUUID();
    const outcome =
      process.env.PAYMENT_STUB_FORCE_SUCCESS === '1'
        ? { success: true, delayMs: 0, stubSequence: 'test:forced-success' }
        : (paymentOutcomeOverride(input.body.paymentToken) ??
          getPaymentStubRunSequence().nextOutcome());
    if (!input.skipPaymentDelay && outcome.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, outcome.delayMs));
    }

    await conn.query(
      `INSERT INTO payments (id, run_id, booking_id, status, stub_sequence)
       VALUES (?, ?, ?, 'PENDING', ?)`,
      [paymentId, input.runId, bookingId, outcome.stubSequence],
    );

    if (!outcome.success) {
      const failed = await finalizeBookingAfterPaymentFailure(conn, {
        bookingId,
        inventoryId: input.body.inventoryId,
        seatCount,
        inventoryVersionAfterClaim: claim.version,
        paymentId,
      });
      if (!failed.ok) {
        throw new RailFluxError('INTERNAL_ERROR', 'Payment failure finalize failed', 500);
      }
      const terminal = bookingResult(bookingId, 'FAILED', null);
      await completeIdempotencyTerminal(conn, {
        idempotencyKeyHash: input.idempotencyKeyHash,
        bookingId,
        responseBody: terminal,
      });
      await conn.commit();
      return { kind: 'payment_failed', status: 422, body: terminal };
    }

    const simulatedPnr = generateSimulatedPnr(bookingId);
    assertBookingTransition('PAYMENT_PENDING', 'CONFIRMED');
    await conn.query(
      `UPDATE bookings SET status = 'CONFIRMED', simulated_pnr = ? WHERE id = ?`,
      [simulatedPnr, bookingId],
    );
    await conn.query(`UPDATE payments SET status = 'SUCCESS' WHERE id = ?`, [paymentId]);

    outboxEventId = randomUUID();
    await insertBookingConfirmedOutboxEvent(conn, {
      eventId: outboxEventId,
      bookingId,
      runId: input.runId,
      userId: input.body.userId,
    });

    successTerminal = bookingResult(bookingId, 'CONFIRMED', simulatedPnr);
    await completeIdempotencyTerminal(conn, {
      idempotencyKeyHash: input.idempotencyKeyHash,
      bookingId,
      responseBody: successTerminal,
    });

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  if (outboxEventId && successTerminal) {
    if (getOutboxDeliveryMode() === 'sqs') {
      const sqsConfig = loadSideEffectsSqsConfig();
      const sqsClient = createSideEffectsSqsClient(sqsConfig);
      try {
        await publishBookingConfirmedOutboxToSqs(pool, { eventId: outboxEventId }, sqsClient, sqsConfig.queueUrl);
      } catch (err) {
        console.error(
          JSON.stringify({
            event: 'outbox_sqs_publish_failed',
            eventId: outboxEventId,
            runId: input.runId,
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    } else {
      const syncConn = await pool.getConnection();
      try {
        await syncConn.beginTransaction();
        await processBookingConfirmedOutboxSynchronously(syncConn, {
          eventId: outboxEventId,
          runId: input.runId,
        });
        await syncConn.commit();
      } catch (err) {
        await syncConn.rollback();
        throw err;
      } finally {
        syncConn.release();
      }
    }

    return { kind: 'created', status: 201, body: successTerminal };
  }

  throw new RailFluxError('INTERNAL_ERROR', 'Unhandled booking outcome', 500);
}

export async function createBooking(
  pool: DbPool,
  input: CreateBookingInput,
): Promise<CreateBookingHttpResult> {
  for (let attempt = 0; attempt < CREATE_BOOKING_DEADLOCK_RETRIES; attempt += 1) {
    try {
      return await createBookingAttempt(pool, input);
    } catch (err) {
      if (isDeadlockError(err) && attempt < CREATE_BOOKING_DEADLOCK_RETRIES - 1) {
        continue;
      }
      throw err;
    }
  }
  throw new RailFluxError('INTERNAL_ERROR', 'Booking failed after deadlock retries', 503);
}
