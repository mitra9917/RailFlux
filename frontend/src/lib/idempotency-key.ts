/** OpenAPI Idempotency-Key: 16–128 chars. */
export function generateIdempotencyKey(prefix = 'rf-book'): string {
  const key = `${prefix}-${crypto.randomUUID()}`;
  if (key.length < 16) {
    return `${key}-${crypto.randomUUID()}`.slice(0, 128);
  }
  return key.slice(0, 128);
}
