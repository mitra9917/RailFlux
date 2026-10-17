import express from 'express';
import type { ServiceConfig } from './config.js';
import type { DbPool } from './db.js';
import { createHealthRouter } from './routes/health.js';

export function createApp(_config: ServiceConfig, pool: DbPool) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.use(createHealthRouter(pool));

  app.get('/health', (_req, res) => {
    res.redirect(308, '/health/live');
  });

  return app;
}
