import express, { Router } from 'express';
import type { DbPool } from '@railflux/baseline/db.js';
import { createBookingsRouter } from '@railflux/baseline/routes/bookings.js';
import { createHealthRouter } from '@railflux/baseline/routes/health.js';
import { createSyntheticJwtMiddleware } from '@railflux/baseline/middleware/synthetic-jwt.js';
import { createRequestLoggingMiddleware } from '@railflux/baseline/middleware/request-logging.js';
import type { BookingServiceConfig } from './config.js';

function createBookingV1Router(pool: DbPool): Router {
  const router = Router();
  router.use(createBookingsRouter(pool));
  return router;
}

/** Optimized write path: `/v1/bookings` only (reads stay on read service / edge). */
export function createBookingApp(config: BookingServiceConfig, pool: DbPool) {
  const app = express();
  app.disable('x-powered-by');
  app.use(createRequestLoggingMiddleware('optimized'));
  app.use(express.json({ limit: '64kb' }));

  app.use(createHealthRouter(pool));

  app.use(
    '/v1',
    createSyntheticJwtMiddleware(config.syntheticJwtSecret),
    createBookingV1Router(pool),
  );

  app.get('/health', (_req, res) => {
    res.redirect(308, '/health/live');
  });

  return app;
}
