/**
 * Hand-maintained from docs/design/api-spec.yaml v1.0.0.
 * Regenerate or diff when the OpenAPI contract changes (ADR-011).
 */

export type TravelClass = 'SL' | '3A' | '2A';
export type Quota = 'TATKAL';
export type CacheStatus = 'HIT' | 'MISS' | 'BYPASS';

export type Freshness = {
  observedAt: string;
  authoritative: false;
  cacheStatus: CacheStatus;
};

export type TrainRun = {
  trainRunId: string;
  trainNo: string;
  name: string;
  date: string;
  from: string;
  to: string;
};

export type SearchTrainsResponse = {
  items: TrainRun[];
  freshness: Freshness;
};

export type Availability = {
  trainRunId: string;
  class: TravelClass;
  quota: Quota;
  displayedSeats: number;
  freshness: Freshness;
};

export type Passenger = {
  syntheticName: string;
  age: number;
};

export type CreateBookingRequest = {
  userId: string;
  inventoryId: string;
  passengers: Passenger[];
  paymentToken: string;
};

export type BookingStatus =
  | 'RECEIVED'
  | 'PAYMENT_PENDING'
  | 'CONFIRMED'
  | 'SOLD_OUT'
  | 'FAILED';

export type BookingResultErrorCode =
  | 'SOLD_OUT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PAYMENT_FAILED'
  | 'VALIDATION_ERROR'
  | 'ADMISSION_LIMITED';

export type BookingResult = {
  bookingId: string;
  simulatedPnr: string | null;
  status: BookingStatus;
  errorCode?: BookingResultErrorCode | null;
};

export type BookingInProgressStatus = 'RECEIVED' | 'PAYMENT_PENDING';

export type BookingInProgress = {
  bookingId: string;
  status: BookingInProgressStatus;
  retryAfterMs: number;
};

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'SOLD_OUT'
  | 'ADMISSION_LIMITED'
  | 'INTERNAL_ERROR';

export type ErrorResponse = {
  errorCode: ApiErrorCode;
  message: string;
};

export type HealthState = 'ok' | 'degraded' | 'fail';

export type HealthStatus = {
  status: HealthState;
};
