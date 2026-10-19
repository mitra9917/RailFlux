import { createHash } from 'node:crypto';
import type { CreateBookingRequest } from './api-types.js';
import { RailFluxError } from './errors.js';

const IDEMPOTENCY_KEY_MIN = 16;
const IDEMPOTENCY_KEY_MAX = 128;

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Hash client idempotency key for storage (never log the raw key). */
export function hashIdempotencyKey(idempotencyKey: string): string {
  return sha256Hex(idempotencyKey);
}

/** Stable request fingerprint for replay vs conflict detection. */
export function hashBookingRequest(body: CreateBookingRequest): string {
  const canonical = JSON.stringify({
    userId: body.userId,
    inventoryId: body.inventoryId,
    passengers: body.passengers.map((p) => ({
      syntheticName: p.syntheticName,
      age: p.age,
    })),
    paymentToken: body.paymentToken,
  });
  return sha256Hex(canonical);
}

/** OpenAPI `Idempotency-Key` header (required on POST /v1/bookings). */
export function parseIdempotencyKeyHeader(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw.length < IDEMPOTENCY_KEY_MIN || raw.length > IDEMPOTENCY_KEY_MAX) {
    throw new RailFluxError('VALIDATION_ERROR', 'Invalid or missing Idempotency-Key', 400);
  }
  return raw;
}
