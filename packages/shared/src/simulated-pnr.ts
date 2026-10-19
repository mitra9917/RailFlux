import { createHash } from 'node:crypto';

/** Deterministic RF########## PNR from booking id (OpenAPI pattern). */
export function generateSimulatedPnr(bookingId: string): string {
  const hex = createHash('sha256').update(bookingId, 'utf8').digest('hex').slice(0, 15);
  const n = BigInt(`0x${hex}`) % 10_000_000_000n;
  return `RF${n.toString().padStart(10, '0')}`;
}
