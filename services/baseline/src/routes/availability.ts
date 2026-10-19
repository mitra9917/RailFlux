import { Router } from 'express';
import { RailFluxError, parseAvailabilityQuery } from '@railflux/shared';
import type { DbPool } from '../db.js';
import { getAvailability } from '../services/get-availability.js';

export function createAvailabilityRouter(pool: DbPool): Router {
  const router = Router();

  router.get('/availability', async (req, res, next) => {
    try {
      const query = parseAvailabilityQuery(req.query as Record<string, unknown>);
      const body = await getAvailability(pool, query);
      res.status(200).json(body);
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
