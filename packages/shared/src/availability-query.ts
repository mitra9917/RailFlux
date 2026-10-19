import type { Quota, TravelClass } from './api-types.js';
import { RailFluxError } from './errors.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TRAVEL_CLASSES: readonly TravelClass[] = ['SL', '3A', '2A'];
const QUOTAS: readonly Quota[] = ['TATKAL'];

function one(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function invalid(message: string): never {
  throw new RailFluxError('VALIDATION_ERROR', message, 400);
}

export type AvailabilityQuery = {
  trainRunId: string;
  class: TravelClass;
  quota: Quota;
};

/** OpenAPI `getAvailability` query parameters. */
export function parseAvailabilityQuery(raw: Record<string, unknown>): AvailabilityQuery {
  const trainRunId = one(raw.trainRunId);
  const travelClass = one(raw.class);
  const quota = one(raw.quota);

  if (!trainRunId || !UUID_RE.test(trainRunId)) invalid('Invalid trainRunId');
  if (!travelClass || !TRAVEL_CLASSES.includes(travelClass as TravelClass)) {
    invalid('Invalid class');
  }
  if (!quota || !QUOTAS.includes(quota as Quota)) invalid('Invalid quota');

  return {
    trainRunId,
    class: travelClass as TravelClass,
    quota: quota as Quota,
  };
}

export function notFound(message = 'Unknown train run or inventory bucket'): RailFluxError {
  return new RailFluxError('NOT_FOUND', message, 404);
}
