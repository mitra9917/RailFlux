export type HttpOperation = 'search' | 'availability' | 'booking' | 'health' | 'unknown';

export function operationFromPath(path: string): HttpOperation {
  if (path === '/health/live' || path === '/health/ready' || path === '/health') {
    return 'health';
  }
  if (path.startsWith('/v1/search')) return 'search';
  if (path.startsWith('/v1/availability')) return 'availability';
  if (path.startsWith('/v1/bookings')) return 'booking';
  return 'unknown';
}
