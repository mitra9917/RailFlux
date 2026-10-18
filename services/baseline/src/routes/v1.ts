import { Router } from 'express';
import type { DbPool } from '../db.js';
import { createSearchRouter } from './search.js';

/** OpenAPI `/v1/*` routes mount here (availability, bookings in later issues). */
export function createV1Router(pool: DbPool): Router {
  const router = Router();
  router.use(createSearchRouter(pool));
  return router;
}
