import { HEADER_IDEMPOTENCY_KEY } from '@railflux/shared';

export function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? '3306'),
    user: process.env.MYSQL_USER ?? 'railflux',
    password: process.env.MYSQL_PASSWORD ?? 'railflux',
    database: process.env.MYSQL_DATABASE ?? 'railflux',
  };
}

/** Consume one failing stub outcome so the next POST uses a successful attempt (manifest attempt 0 fails). */
export async function primePaymentStubForSuccess() {
  const { getPaymentStubRunSequence, resetPaymentStubRun } = await import(
    '../../services/baseline/dist/services/payment-stub.js'
  );
  resetPaymentStubRun();
  const seq = getPaymentStubRunSequence();
  const first = seq.nextOutcome();
  if (first.success) {
    throw new Error('expected attempt 0 to fail for default manifest in tests');
  }
}

export async function postBooking(baseUrl, token, idempotencyKey, body, runId) {
  const headers = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    [HEADER_IDEMPOTENCY_KEY]: idempotencyKey,
  };
  if (runId) {
    headers['X-Run-Id'] = runId;
  }
  const res = await fetch(`${baseUrl}/v1/bookings`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed };
}
