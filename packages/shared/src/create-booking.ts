import type { CreateBookingRequest, Passenger } from './api-types.js';
import { RailFluxError } from './errors.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalid(message: string): never {
  throw new RailFluxError('VALIDATION_ERROR', message, 400);
}

function parsePassenger(raw: unknown): Passenger {
  if (!raw || typeof raw !== 'object') invalid('Invalid passengers');
  const row = raw as Record<string, unknown>;
  const syntheticName = typeof row.syntheticName === 'string' ? row.syntheticName.trim() : '';
  const age = typeof row.age === 'number' ? row.age : Number(row.age);
  if (!syntheticName || syntheticName.length > 80) invalid('Invalid passenger syntheticName');
  if (!Number.isInteger(age) || age < 1 || age > 120) invalid('Invalid passenger age');
  return { syntheticName, age };
}

/** OpenAPI `CreateBooking` request body. */
export function parseCreateBookingBody(raw: unknown): CreateBookingRequest {
  if (!raw || typeof raw !== 'object') invalid('Invalid booking body');
  const body = raw as Record<string, unknown>;
  const userId = typeof body.userId === 'string' ? body.userId : '';
  const inventoryId = typeof body.inventoryId === 'string' ? body.inventoryId : '';
  const paymentToken = typeof body.paymentToken === 'string' ? body.paymentToken : '';
  if (!userId || !UUID_RE.test(userId)) invalid('Invalid userId');
  if (!inventoryId || !UUID_RE.test(inventoryId)) invalid('Invalid inventoryId');
  if (paymentToken.length < 8 || paymentToken.length > 128) invalid('Invalid paymentToken');
  if (!Array.isArray(body.passengers) || body.passengers.length < 1 || body.passengers.length > 4) {
    invalid('Invalid passengers');
  }
  const passengers = body.passengers.map(parsePassenger);
  return { userId, inventoryId, passengers, paymentToken };
}
