import {
  TC001_FROM,
  TC001_TO,
  TC001_JOURNEY_DATE,
  TC001_TRAIN_RUN_ID,
  TC001_INVENTORY_3A_ID,
  TC001_USER_ID,
} from '../fixtures/tc001-demo';

/** Vite dev proxy prefix, e.g. /compare-baseline or /compare-optimized */
export type CompareApiPrefix = '/compare-baseline' | '/compare-optimized' | '';

export type ArchitectureProbeResult = {
  architecture: 'baseline' | 'optimized';
  ok: boolean;
  totalMs: number;
  searchMs: number;
  availabilityMs: number;
  bookingMs: number;
  cacheStatus: string | null;
  bookingStatus: string | null;
  simulatedPnr: string | null;
  error: string | null;
};

function url(prefix: CompareApiPrefix, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${prefix}${p}`;
}

export async function probeArchitectureBooking(
  architecture: 'baseline' | 'optimized',
  apiPrefix: CompareApiPrefix,
  token: string,
  idempotencyKey: string,
): Promise<ArchitectureProbeResult> {
  const auth = { authorization: `Bearer ${token}` };
  const t0 = performance.now();
  let searchMs = 0;
  let availabilityMs = 0;
  let bookingMs = 0;

  try {
    const sq = new URLSearchParams({ from: TC001_FROM, to: TC001_TO, date: TC001_JOURNEY_DATE });
    const tSearch = performance.now();
    const searchRes = await fetch(url(apiPrefix, `/v1/search?${sq}`), { headers: auth });
    searchMs = performance.now() - tSearch;
    if (!searchRes.ok) {
      const body = await searchRes.text();
      throw new Error(`search ${searchRes.status}: ${body.slice(0, 120)}`);
    }
    const searchBody = await searchRes.json();
    if (!searchBody.items?.some((r: { trainRunId: string }) => r.trainRunId === TC001_TRAIN_RUN_ID)) {
      throw new Error('TC-001 train run not in search results');
    }

    const avQ = new URLSearchParams({
      trainRunId: TC001_TRAIN_RUN_ID,
      class: '3A',
      quota: 'TATKAL',
    });
    const tAv = performance.now();
    const avRes = await fetch(url(apiPrefix, `/v1/availability?${avQ}`), { headers: auth });
    availabilityMs = performance.now() - tAv;
    if (!avRes.ok) throw new Error(`availability ${avRes.status}`);
    const avBody = await avRes.json();
    const cacheStatus = avBody.freshness?.cacheStatus ?? null;

    const bookBody = {
      userId: TC001_USER_ID,
      inventoryId: TC001_INVENTORY_3A_ID,
      passengers: [{ syntheticName: 'Synthetic Pax', age: 30 }],
      paymentToken: 'stub-payment-token',
    };
    let bookJson: {
      status?: string;
      simulatedPnr?: string;
      errorCode?: string;
    } = {};
    let bookRes: Response | null = null;
    let attemptKey = idempotencyKey;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const tBook = performance.now();
      bookRes = await fetch(url(apiPrefix, '/v1/bookings'), {
        method: 'POST',
        headers: {
          ...auth,
          'content-type': 'application/json',
          'Idempotency-Key': attemptKey,
        },
        body: JSON.stringify(bookBody),
      });
      bookingMs += performance.now() - tBook;
      bookJson = await bookRes.json();
      if (bookRes.status === 201 && bookJson.status === 'CONFIRMED') break;
      if (bookRes.status === 422 && bookJson.errorCode === 'PAYMENT_FAILED') {
        attemptKey = `${idempotencyKey}-retry-${attempt + 1}`;
        continue;
      }
      break;
    }

    if (!bookRes?.ok || bookJson.status !== 'CONFIRMED') {
      throw new Error(
        `booking ${bookRes?.status ?? '?'} ${bookJson.errorCode ?? bookJson.status ?? ''}`.trim(),
      );
    }

    return {
      architecture,
      ok: true,
      totalMs: performance.now() - t0,
      searchMs,
      availabilityMs,
      bookingMs,
      cacheStatus,
      bookingStatus: bookJson.status,
      simulatedPnr: bookJson.simulatedPnr ?? null,
      error: null,
    };
  } catch (err) {
    return {
      architecture,
      ok: false,
      totalMs: performance.now() - t0,
      searchMs,
      availabilityMs,
      bookingMs,
      cacheStatus: null,
      bookingStatus: null,
      simulatedPnr: null,
      error: err instanceof Error ? err.message : 'Probe failed',
    };
  }
}

export async function checkCompareHealth(apiPrefix: CompareApiPrefix): Promise<boolean> {
  try {
    const res = await fetch(url(apiPrefix, '/health/live'));
    return res.ok;
  } catch {
    return false;
  }
}
