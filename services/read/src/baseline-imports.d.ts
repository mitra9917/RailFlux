declare module '@railflux/baseline/db.js' {
  import type mysql from 'mysql2/promise';

  export type DbPool = mysql.Pool;

  export function createPool(config: {
    nodeEnv: string;
    port: number;
    profile: 'baseline';
    syntheticJwtSecret: string;
    mysql: {
      host: string;
      port: number;
      user: string;
      password: string;
      database: string;
    };
  }): DbPool;

  export function pingDatabase(pool: DbPool): Promise<boolean>;
}

declare module '@railflux/baseline/routes/search.js' {
  import type { Router } from 'express';
  import type { DbPool } from '@railflux/baseline/db.js';
  export function createSearchRouter(pool: DbPool): Router;
}

declare module '@railflux/baseline/routes/availability.js' {
  import type { Router } from 'express';
  import type { DbPool } from '@railflux/baseline/db.js';
  export function createAvailabilityRouter(pool: DbPool): Router;
}

declare module '@railflux/baseline/routes/health.js' {
  import type { Router } from 'express';
  import type { DbPool } from '@railflux/baseline/db.js';
  export function createHealthRouter(pool: DbPool): Router;
}

declare module '@railflux/baseline/middleware/synthetic-jwt.js' {
  import type { RequestHandler } from 'express';
  export function createSyntheticJwtMiddleware(secret: string): RequestHandler;
}

declare module '@railflux/baseline/middleware/request-logging.js' {
  import type { RequestHandler } from 'express';
  export type RequestLogArchitecture = 'baseline' | 'optimized';
  export function createRequestLoggingMiddleware(
    architecture: RequestLogArchitecture,
  ): RequestHandler;
}
