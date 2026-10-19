import { Router } from 'express';
import { RailFluxError, parseAvailabilityQuery } from '@railflux/shared';
import type { AvailabilityReader } from '../cache/availability-cache.js';

export function createReadAvailabilityRouter(reader: AvailabilityReader): Router {
  const router = Router();

  router.get('/availability', async (req, res, next) => {
    try {
      const query = parseAvailabilityQuery(req.query as Record<string, unknown>);
      const body = await reader.getAvailability(query);
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
