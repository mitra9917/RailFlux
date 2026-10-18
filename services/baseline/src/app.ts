import express from 'express';
import type { ServiceConfig } from './config.js';
import type { DbPool } from './db.js';
import { createSyntheticJwtMiddleware } from './middleware/synthetic-jwt.js';
import { createHealthRouter } from './routes/health.js';
import { createV1Router } from './routes/v1.js';

export function createApp(config: ServiceConfig, pool: DbPool) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.use(createHealthRouter(pool));

  app.use(
    '/v1',
    createSyntheticJwtMiddleware(config.syntheticJwtSecret),
    createV1Router(),
  );

  app.get('/health', (_req, res) => {
    res.redirect(308, '/health/live');
  });

  return app;
}
