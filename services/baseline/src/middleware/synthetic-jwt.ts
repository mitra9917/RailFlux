import type { RequestHandler } from 'express';
import {
  HEADER_AUTHORIZATION,
  RailFluxError,
  verifySyntheticJwt,
} from '@railflux/shared';

export function createSyntheticJwtMiddleware(secret: string): RequestHandler {
  return async (req, res, next) => {
    const header = req.headers[HEADER_AUTHORIZATION.toLowerCase()];
    const value = typeof header === 'string' ? header : header?.[0];
    if (!value?.startsWith('Bearer ')) {
      res.status(401).json({
        errorCode: 'UNAUTHORIZED',
        message: 'Missing or invalid bearer token',
      });
      return;
    }

    const token = value.slice('Bearer '.length).trim();
    try {
      req.syntheticAuth = await verifySyntheticJwt(token, secret);
      next();
    } catch (err) {
      const message =
        err instanceof RailFluxError ? err.message : 'Missing or invalid bearer token';
      res.status(401).json({ errorCode: 'UNAUTHORIZED', message });
    }
  };
}
