export const BOOKING_CONFIRMED_EVENT_TYPE = 'BOOKING_CONFIRMED' as const;
export const BOOKING_AGGREGATE_TYPE = 'booking' as const;
export const BASELINE_BOOKING_CONFIRMED_HANDLER = 'SYNTHETIC_NOTIFICATION' as const;
/** SQS / ElasticMQ side-effects queue name (cache-and-queue design). */
export const SIDE_EFFECTS_QUEUE_NAME = 'railflux-side-effects' as const;
/** Dead-letter queue for poison side-effect messages (FT-004). */
export const SIDE_EFFECTS_DLQ_NAME = 'railflux-side-effects-dlq' as const;
/** SQS redrive threshold before a message moves to the DLQ (cache-and-queue MVP). */
export const SIDE_EFFECTS_MAX_RECEIVE_COUNT = 3;

export type BookingConfirmedSideEffectPayload = {
  notificationTarget: string;
};

/** Queue-shaped message persisted in `outbox_events.payload` (no PII beyond synthetic user id). */
export type BookingConfirmedOutboxMessage = {
  schemaVersion: 1;
  eventId: string;
  eventType: typeof BOOKING_CONFIRMED_EVENT_TYPE;
  bookingId: string;
  runId: string;
  occurredAt: string;
  payload: BookingConfirmedSideEffectPayload;
};

export function buildBookingConfirmedOutboxMessage(input: {
  eventId: string;
  bookingId: string;
  runId: string;
  userId: string;
  occurredAt: Date;
}): BookingConfirmedOutboxMessage {
  return {
    schemaVersion: 1,
    eventId: input.eventId,
    eventType: BOOKING_CONFIRMED_EVENT_TYPE,
    bookingId: input.bookingId,
    runId: input.runId,
    occurredAt: input.occurredAt.toISOString(),
    payload: {
      notificationTarget: input.userId,
    },
  };
}
