import { Router } from 'express';
import {
  RailFluxError,
  parseSearchTrainsQuery,
  type SearchTrainsResponse,
} from '@railflux/shared';
import type { DbPool } from '../db.js';
import { baselineReadFreshness } from '../freshness.js';
import { searchTrains } from '../services/search-trains.js';

export function createSearchRouter(pool: DbPool): Router {
  const router = Router();

  router.get('/search', async (req, res, next) => {
    try {
      const query = parseSearchTrainsQuery(req.query as Record<string, unknown>);
      const items = await searchTrains(pool, query);
      const body: SearchTrainsResponse = {
        items,
        freshness: baselineReadFreshness(),
      };
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
