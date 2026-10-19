import { Router } from 'express';
import type { DbPool } from '../db.js';
import { createAvailabilityRouter } from './availability.js';
import { createSearchRouter } from './search.js';

/** OpenAPI `/v1/*` routes mount here (bookings in later issues). */
export function createV1Router(pool: DbPool): Router {
  const router = Router();
  router.use(createSearchRouter(pool));
  router.use(createAvailabilityRouter(pool));
  return router;
}
