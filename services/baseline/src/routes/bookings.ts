import { Router } from 'express';
import {
  HEADER_IDEMPOTENCY_KEY,
  RailFluxError,
  hashBookingRequest,
  hashIdempotencyKey,
  parseCreateBookingBody,
  parseIdempotencyKeyHeader,
} from '@railflux/shared';
import type { DbPool } from '../db.js';
import {
  idempotencyConflictError,
  resolveIdempotencyReplay,
} from '../services/booking-idempotency.js';

export function createBookingsRouter(pool: DbPool): Router {
  const router = Router();

  router.post('/bookings', async (req, res, next) => {
    try {
      const idempotencyKey = parseIdempotencyKeyHeader(req.header(HEADER_IDEMPOTENCY_KEY));
      const body = parseCreateBookingBody(req.body);
      const idempotencyKeyHash = hashIdempotencyKey(idempotencyKey);
      const requestHash = hashBookingRequest(body);

      const resolved = await resolveIdempotencyReplay(pool, {
        idempotencyKeyHash,
        requestHash,
      });

      if (resolved.type === 'conflict') {
        throw idempotencyConflictError();
      }
      if (resolved.type === 'replay') {
        res.status(200).json(resolved.body);
        return;
      }

      throw new RailFluxError(
        'INTERNAL_ERROR',
        'Booking creation is not implemented yet',
        501,
      );
    } catch (err) {
      if (err instanceof RailFluxError) {
        res.status(err.httpStatus).json(err.toJSON());
        return;
      }
      next(err);
    }
  });

  return router;
}
