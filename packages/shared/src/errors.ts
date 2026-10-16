import type { ApiErrorCode, BookingResultErrorCode } from './api-types.js';

export class RailFluxError extends Error {
  readonly errorCode: ApiErrorCode;
  readonly httpStatus: number;

  constructor(errorCode: ApiErrorCode, message: string, httpStatus: number) {
    super(message);
    this.name = 'RailFluxError';
    this.errorCode = errorCode;
    this.httpStatus = httpStatus;
  }

  toJSON(): { errorCode: ApiErrorCode; message: string } {
    return { errorCode: this.errorCode, message: this.message };
  }
}

export function isBookingResultErrorCode(
  value: string | null | undefined,
): value is BookingResultErrorCode {
  return (
    value === 'SOLD_OUT' ||
    value === 'IDEMPOTENCY_CONFLICT' ||
    value === 'PAYMENT_FAILED' ||
    value === 'VALIDATION_ERROR' ||
    value === 'ADMISSION_LIMITED'
  );
}
