import { Router, type Response } from 'express';
import { HEALTH_LIVE_PATH, HEALTH_READY_PATH, type HealthStatus } from '@railflux/shared';
import type { EdgeServiceConfig } from './config.js';

function sendHealthJson(res: Response, status: number, body: HealthStatus) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

async function upstreamReady(origin: string): Promise<boolean> {
  try {
    const res = await fetch(new URL(HEALTH_READY_PATH, origin), { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

export function createEdgeHealthRouter(config: EdgeServiceConfig): Router {
  const router = Router();

  router.get(HEALTH_LIVE_PATH, (_req, res) => {
    sendHealthJson(res, 200, { status: 'ok' });
  });

  router.get(HEALTH_READY_PATH, async (_req, res) => {
    const [readOk, bookingOk] = await Promise.all([
      upstreamReady(config.readUpstream),
      upstreamReady(config.bookingUpstream),
    ]);
    const ok = readOk && bookingOk;
    sendHealthJson(res, ok ? 200 : 503, { status: ok ? 'ok' : 'fail' });
  });

  return router;
}
