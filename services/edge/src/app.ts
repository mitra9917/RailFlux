import express, { Router } from 'express';
import { buildServiceRootBody, RailFluxError } from '@railflux/shared';
import type { EdgeServiceConfig } from './config.js';
import { createEdgeHealthRouter } from './health.js';
import { createUpstreamProxy, pickUpstreamOrigin } from './upstream-proxy.js';

function createEdgeV1Router(config: EdgeServiceConfig): Router {
  const router = Router();

  router.use((req, res, next) => {
    const upstream = pickUpstreamOrigin(config, req.path);
    if (!upstream) {
      const err = new RailFluxError('NOT_FOUND', 'No upstream route for path', 404);
      res.status(err.httpStatus).json(err.toJSON());
      return;
    }
    return createUpstreamProxy(upstream)(req, res, next);
  });

  return router;
}

/** Local edge: same `/v1/*` OpenAPI paths as baseline, routed to read vs booking upstreams. */
export function createEdgeApp(config: EdgeServiceConfig) {
  const app = express();
  app.disable('x-powered-by');

  app.use(createEdgeHealthRouter(config));

  app.get('/', (_req, res) => {
    res.json(buildServiceRootBody({ service: 'edge', architecture: 'optimized-edge' }));
  });

  app.use('/v1', createEdgeV1Router(config));

  app.get('/health', (_req, res) => {
    res.redirect(308, '/health/live');
  });

  return app;
}
