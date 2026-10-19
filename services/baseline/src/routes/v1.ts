import { Router } from 'express';
import type { DbPool } from '../db.js';
import { createAvailabilityRouter } from './availability.js';
import { createBookingsRouter } from './bookings.js';
import { createSearchRouter } from './search.js';

/** OpenAPI `/v1/*` routes mount here. */
export function createV1Router(pool: DbPool): Router {
  const router = Router();
  router.use(createSearchRouter(pool));
  router.use(createAvailabilityRouter(pool));
  router.use(createBookingsRouter(pool));
  return router;
}
