import express, { Router } from 'express';
import type { DbPool } from '@railflux/baseline/db.js';
import { createAvailabilityRouter } from '@railflux/baseline/routes/availability.js';
import { createHealthRouter } from '@railflux/baseline/routes/health.js';
import { createSearchRouter } from '@railflux/baseline/routes/search.js';
import { createSyntheticJwtMiddleware } from '@railflux/baseline/middleware/synthetic-jwt.js';
import { createRequestLoggingMiddleware } from '@railflux/baseline/middleware/request-logging.js';
import type { ReadServiceConfig } from './config.js';

function createReadV1Router(pool: DbPool): Router {
  const router = Router();
  router.use(createSearchRouter(pool));
  router.use(createAvailabilityRouter(pool));
  return router;
}

/** Optimized read path: `/v1/search` and `/v1/availability` only (bookings stay on booking service). */
export function createReadApp(config: ReadServiceConfig, pool: DbPool) {
  const app = express();
  app.disable('x-powered-by');
  app.use(createRequestLoggingMiddleware('optimized'));
  app.use(express.json({ limit: '64kb' }));

  app.use(createHealthRouter(pool));

  app.use(
    '/v1',
    createSyntheticJwtMiddleware(config.syntheticJwtSecret),
    createReadV1Router(pool),
  );

  app.get('/health', (_req, res) => {
    res.redirect(308, '/health/live');
  });

  return app;
}
