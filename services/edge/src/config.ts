export type EdgeServiceConfig = {
  nodeEnv: string;
  port: number;
  readUpstream: string;
  bookingUpstream: string;
};

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeOrigin(value: string, envName: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${envName} must be a valid URL origin (got ${value})`);
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${envName} must be an origin only (no path/query/hash)`);
  }
  return url.origin;
}

export function loadEdgeConfig(env: NodeJS.ProcessEnv = process.env): EdgeServiceConfig {
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: Number(env.PORT ?? '3000'),
    readUpstream: normalizeOrigin(
      required('READ_UPSTREAM', env.READ_UPSTREAM ?? 'http://127.0.0.1:3001'),
      'READ_UPSTREAM',
    ),
    bookingUpstream: normalizeOrigin(
      required('BOOKING_UPSTREAM', env.BOOKING_UPSTREAM ?? 'http://127.0.0.1:3002'),
      'BOOKING_UPSTREAM',
    ),
  };
}
