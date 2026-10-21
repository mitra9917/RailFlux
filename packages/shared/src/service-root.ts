import { HEALTH_LIVE_PATH, HEALTH_READY_PATH } from './health-paths.js';

export type ServiceRootArchitecture =
  | 'baseline-monolith'
  | 'optimized-edge'
  | 'optimized-read'
  | 'optimized-booking';

/** JSON body for `GET /` — API services have no HTML homepage. */
export function buildServiceRootBody(input: {
  service: string;
  architecture: ServiceRootArchitecture;
}): {
  service: string;
  architecture: ServiceRootArchitecture;
  message: string;
  paths: { healthLive: string; healthReady: string; api: string };
} {
  return {
    service: input.service,
    architecture: input.architecture,
    message:
      'RailFlux JSON API only (not IRCTC, not a website). Try /health/ready in the browser, or /v1/* with Authorization: Bearer <synthetic JWT>.',
    paths: {
      healthLive: HEALTH_LIVE_PATH,
      healthReady: HEALTH_READY_PATH,
      api: '/v1',
    },
  };
}
