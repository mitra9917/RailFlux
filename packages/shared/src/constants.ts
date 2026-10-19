/** HTTP header names from OpenAPI v1 parameters. */
export const HEADER_RUN_ID = 'X-Run-Id';
export const HEADER_REQUEST_ID = 'X-Request-Id';
export const HEADER_IDEMPOTENCY_KEY = 'Idempotency-Key';
export const HEADER_AUTHORIZATION = 'Authorization';

export const API_VERSION = '1.0.0' as const;

/** OpenAPI `BookingInProgress.retryAfterMs` default for 425 responses. */
export const DEFAULT_BOOKING_RETRY_AFTER_MS = 500;
