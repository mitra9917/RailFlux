import { Router } from 'express';
import {
  HEADER_IDEMPOTENCY_KEY,
  RailFluxError,
  hashBookingRequest,
  hashIdempotencyKey,
  parseBookingIdParam,
  parseCreateBookingBody,
  parseIdempotencyKeyHeader,
} from '@railflux/shared';
import type { DbPool } from '../db.js';
import {
  idempotencyConflictError,
  resolveBookingInProgressResponse,
  resolveIdempotencyReplay,
} from '../services/booking-idempotency.js';
import { createBooking } from '../services/create-booking.js';
import { getBookingResult } from '../services/get-booking.js';

const DEFAULT_RUN_ID = 'baseline-local';

export function createBookingsRouter(pool: DbPool): Router {
  const router = Router();

  router.get('/bookings/:bookingId', async (req, res, next) => {
    try {
      const bookingId = parseBookingIdParam(req.params.bookingId);
      const result = await getBookingResult(pool, bookingId);
      if (!result) {
        throw new RailFluxError('NOT_FOUND', 'Booking not found', 404);
      }
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof RailFluxError) {
        res.status(err.httpStatus).json(err.toJSON());
        return;
      }
      next(err);
    }
  });

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
      if (resolved.type === 'in_progress') {
        const inProgress = await resolveBookingInProgressResponse(pool, idempotencyKeyHash);
        if (!inProgress) {
          throw new RailFluxError(
            'INTERNAL_ERROR',
            'Idempotency record in progress but booking not linked',
            503,
          );
        }
        res.status(425).json(inProgress);
        return;
      }

      const authUserId = req.syntheticAuth?.userId;
      if (!authUserId || authUserId !== body.userId) {
        throw new RailFluxError('UNAUTHORIZED', 'Token subject does not match userId', 401);
      }

      const runId = req.runId ?? DEFAULT_RUN_ID;
      const created = await createBooking(pool, {
        runId,
        idempotencyKeyHash,
        requestHash,
        body,
        skipPaymentDelay: process.env.NODE_ENV === 'test',
      });

      if (created.kind === 'in_progress') {
        const inProgress = await resolveBookingInProgressResponse(pool, idempotencyKeyHash);
        if (!inProgress) {
          throw new RailFluxError('INTERNAL_ERROR', 'Booking in progress but not linked', 503);
        }
        res.status(425).json(inProgress);
        return;
      }
      if (created.kind === 'sold_out') {
        res.status(409).json(created.error.toJSON());
        return;
      }
      if (created.kind === 'payment_failed') {
        res.status(422).json(created.body);
        return;
      }
      res.status(created.status).json(created.body);
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
