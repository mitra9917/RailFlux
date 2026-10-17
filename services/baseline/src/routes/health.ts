import { Router } from 'express';
import type { HealthStatus } from '@railflux/shared';
import type { DbPool } from '../db.js';
import { pingDatabase } from '../db.js';

export function createHealthRouter(pool: DbPool): Router {
  const router = Router();

  router.get('/health/live', (_req, res) => {
    const body: HealthStatus = { status: 'ok' };
    res.status(200).json(body);
  });

  router.get('/health/ready', async (_req, res) => {
    const ok = await pingDatabase(pool);
    const body: HealthStatus = { status: ok ? 'ok' : 'fail' };
    res.status(ok ? 200 : 503).json(body);
  });

  return router;
}
