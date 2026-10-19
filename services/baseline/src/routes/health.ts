import { Router, type Response } from 'express';
import {
  HEALTH_LIVE_PATH,
  HEALTH_READY_PATH,
  type HealthStatus,
} from '@railflux/shared';
import type { DbPool } from '../db.js';
import { pingDatabase } from '../db.js';

function sendHealthJson(res: Response, status: number, body: HealthStatus) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

export function createHealthRouter(pool: DbPool): Router {
  const router = Router();

  router.get(HEALTH_LIVE_PATH, (_req, res) => {
    sendHealthJson(res, 200, { status: 'ok' });
  });

  router.get(HEALTH_READY_PATH, async (_req, res) => {
    const ok = await pingDatabase(pool);
    sendHealthJson(res, ok ? 200 : 503, { status: ok ? 'ok' : 'fail' });
  });

  return router;
}
