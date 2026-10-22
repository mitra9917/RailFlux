import type {
  BookingInProgress,
  BookingResult,
  BookingStatus,
  CreateBookingRequest,
} from '@railflux/shared/api-types';
import { apiFetch, ApiError } from './client';

const TERMINAL: BookingStatus[] = ['CONFIRMED', 'SOLD_OUT', 'FAILED'];

export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return TERMINAL.includes(status);
}

async function readJsonBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export type CreateBookingResponse =
  | { kind: 'result'; httpStatus: number; result: BookingResult }
  | { kind: 'in_progress'; httpStatus: 425; body: BookingInProgress };

export async function createBooking(
  body: CreateBookingRequest,
  idempotencyKey: string,
): Promise<CreateBookingResponse> {
  const res = await apiFetch('/v1/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  const parsed = await readJsonBody(res);

  if (res.status === 425) {
    return {
      kind: 'in_progress',
      httpStatus: 425,
      body: parsed as BookingInProgress,
    };
  }

  if (res.ok || res.status === 422) {
    return {
      kind: 'result',
      httpStatus: res.status,
      result: parsed as BookingResult,
    };
  }

  const err = parsed as { message?: string; errorCode?: string } | null;
  throw new ApiError(
    err?.message ?? `Booking failed (${res.status})`,
    res.status,
    parsed,
    err?.errorCode,
  );
}

export async function getBooking(bookingId: string): Promise<BookingResult> {
  const res = await apiFetch(`/v1/bookings/${encodeURIComponent(bookingId)}`);
  const parsed = await readJsonBody(res);
  if (!res.ok) {
    const err = parsed as { message?: string; errorCode?: string } | null;
    throw new ApiError(
      err?.message ?? `Get booking failed (${res.status})`,
      res.status,
      parsed,
      err?.errorCode,
    );
  }
  return parsed as BookingResult;
}

export async function pollBookingUntilTerminal(
  bookingId: string,
  options: { maxAttempts?: number; onAttempt?: (attempt: number) => void } = {},
): Promise<BookingResult> {
  const maxAttempts = options.maxAttempts ?? 12;
  let delayMs = 500;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    options.onAttempt?.(attempt);
    const result = await getBooking(bookingId);
    if (isTerminalBookingStatus(result.status)) {
      return result;
    }
    await new Promise((r) => setTimeout(r, delayMs));
    delayMs = Math.min(delayMs * 1.5, 3000);
  }

  throw new ApiError('Booking still in progress after polling limit.', 425);
}
