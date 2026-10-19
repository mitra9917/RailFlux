import { RailFluxError } from './errors.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalid(message: string): never {
  throw new RailFluxError('VALIDATION_ERROR', message, 400);
}

export function parseBookingIdParam(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    invalid('Invalid bookingId');
  }
  const bookingId = value.trim();
  if (!UUID_RE.test(bookingId)) {
    invalid('Invalid bookingId');
  }
  return bookingId;
}
