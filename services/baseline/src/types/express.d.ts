import type { SyntheticAuthContext } from '@railflux/shared';

declare global {
  namespace Express {
    interface Request {
      syntheticAuth?: SyntheticAuthContext;
      requestId?: string;
      runId?: string;
    }
  }
}

export {};
