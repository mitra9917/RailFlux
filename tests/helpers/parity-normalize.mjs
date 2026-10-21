/** Strip cache timing fields allowed to differ between baseline and optimized reads. */
export function normalizeSearchBody(body) {
  const freshness = body.freshness
    ? { authoritative: body.freshness.authoritative }
    : undefined;
  return {
    items: body.items,
    freshness,
  };
}

export function normalizeAvailabilityBody(body) {
  const freshness = body.freshness
    ? { authoritative: body.freshness.authoritative }
    : undefined;
  return {
    trainRunId: body.trainRunId,
    class: body.class,
    quota: body.quota,
    displayedSeats: body.displayedSeats,
    freshness,
  };
}

export function normalizeErrorBody(body) {
  return {
    errorCode: body.errorCode,
    message: typeof body.message === 'string' ? body.message : body.message,
  };
}

/** Booking HTTP outcomes comparable across profiles (UUIDs differ per request). */
export function normalizeBookingCreateOutcome(res) {
  return {
    httpStatus: res.status,
    status: res.body.status,
    errorCode: res.body.errorCode ?? null,
  };
}

export function normalizeGetBookingBody(body) {
  return {
    status: body.status,
    errorCode: body.errorCode ?? null,
  };
}
