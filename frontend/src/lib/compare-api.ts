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

/** Skips payment stub sleep so paired compare measures architecture, not artificial delay. */
export const COMPARE_PROBE_HEADER = 'X-Railflux-Compare-Probe';

export type ArchitectureProbeResult = {
  architecture: 'baseline' | 'optimized';
  ok: boolean;
  /** Same TC-001 session id for both architectures in a paired run. */
  pairedSessionId: string | null;
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

function compareHeaders(token: string, extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    [COMPARE_PROBE_HEADER]: '1',
    ...extra,
  };
  if (typeof window !== 'undefined' && window.location.hostname.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = '1';
  }
  return headers;
}

function searchQuery(): URLSearchParams {
  return new URLSearchParams({ from: TC001_FROM, to: TC001_TO, date: TC001_JOURNEY_DATE });
}

function availabilityQuery(): URLSearchParams {
  return new URLSearchParams({
    trainRunId: TC001_TRAIN_RUN_ID,
    class: '3A',
    quota: 'TATKAL',
  });
}

async function fetchSearch(prefix: CompareApiPrefix, token: string): Promise<number> {
  const t0 = performance.now();
  const searchRes = await fetch(url(prefix, `/v1/search?${searchQuery()}`), {
    headers: compareHeaders(token),
  });
  const ms = performance.now() - t0;
  if (!searchRes.ok) {
    const body = await searchRes.text();
    throw new Error(`search ${searchRes.status}: ${body.slice(0, 120)}`);
  }
  const searchBody = await searchRes.json();
  if (!searchBody.items?.some((r: { trainRunId: string }) => r.trainRunId === TC001_TRAIN_RUN_ID)) {
    throw new Error('TC-001 train run not in search results');
  }
  return ms;
}

async function fetchAvailability(
  prefix: CompareApiPrefix,
  token: string,
): Promise<{ ms: number; cacheStatus: string | null }> {
  const t0 = performance.now();
  const avRes = await fetch(url(prefix, `/v1/availability?${availabilityQuery()}`), {
    headers: compareHeaders(token),
  });
  const ms = performance.now() - t0;
  if (!avRes.ok) throw new Error(`availability ${avRes.status}`);
  const avBody = await avRes.json();
  return { ms, cacheStatus: avBody.freshness?.cacheStatus ?? null };
}

/** Untimed warmup: optimized gets a second availability call so the timed call can be cache HIT. */
async function warmTc001ReadPath(
  architecture: 'baseline' | 'optimized',
  prefix: CompareApiPrefix,
  token: string,
): Promise<void> {
  await fetchSearch(prefix, token);
  await fetchAvailability(prefix, token);
  if (architecture === 'optimized') {
    await fetchAvailability(prefix, token);
  }
}

const TERMINAL = new Set(['CONFIRMED', 'SOLD_OUT', 'FAILED']);

async function bookUntilTerminal(
  prefix: CompareApiPrefix,
  token: string,
  idempotencyKey: string,
): Promise<{ ms: number; status: string; simulatedPnr: string | null }> {
  const bookBody = {
    userId: TC001_USER_ID,
    inventoryId: TC001_INVENTORY_3A_ID,
    passengers: [{ syntheticName: 'Synthetic Pax', age: 30 }],
    paymentToken: 'stub-payment-token',
  };

  let bookingMs = 0;
  let attemptKey = idempotencyKey;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const tBook = performance.now();
    const bookRes = await fetch(url(prefix, '/v1/bookings'), {
      method: 'POST',
      headers: compareHeaders(token, {
        'content-type': 'application/json',
        'Idempotency-Key': attemptKey,
      }),
      body: JSON.stringify(bookBody),
    });
    bookingMs += performance.now() - tBook;
    const bookJson = (await bookRes.json()) as {
      status?: string;
      simulatedPnr?: string;
      errorCode?: string;
      bookingId?: string;
    };

    if (bookRes.status === 201 && bookJson.status && TERMINAL.has(bookJson.status)) {
      return {
        ms: bookingMs,
        status: bookJson.status,
        simulatedPnr: bookJson.simulatedPnr ?? null,
      };
    }

    if (bookRes.status === 425 && bookJson.bookingId) {
      const polled = await pollBookingTerminal(prefix, token, bookJson.bookingId);
      bookingMs += polled.ms;
      return {
        ms: bookingMs,
        status: polled.status,
        simulatedPnr: polled.simulatedPnr,
      };
    }

    if (bookRes.status === 422 && bookJson.errorCode === 'PAYMENT_FAILED') {
      attemptKey = `${idempotencyKey}-retry-${attempt + 1}`;
      continue;
    }

    throw new Error(
      `booking ${bookRes.status} ${bookJson.errorCode ?? bookJson.status ?? ''}`.trim(),
    );
  }

  throw new Error('booking failed after retries');
}

async function pollBookingTerminal(
  prefix: CompareApiPrefix,
  token: string,
  bookingId: string,
): Promise<{ ms: number; status: string; simulatedPnr: string | null }> {
  let delayMs = 40;
  let totalMs = 0;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const t0 = performance.now();
    const res = await fetch(url(prefix, `/v1/bookings/${encodeURIComponent(bookingId)}`), {
      headers: compareHeaders(token),
    });
    totalMs += performance.now() - t0;
    if (!res.ok) throw new Error(`get booking ${res.status}`);
    const body = (await res.json()) as { status: string; simulatedPnr?: string | null };
    if (TERMINAL.has(body.status)) {
      return { ms: totalMs, status: body.status, simulatedPnr: body.simulatedPnr ?? null };
    }
    await new Promise((r) => setTimeout(r, delayMs));
    delayMs = Math.min(delayMs * 1.4, 200);
  }
  throw new Error('booking still in progress after polling');
}

async function probeReadPhase(
  apiPrefix: CompareApiPrefix,
  token: string,
): Promise<{ searchMs: number; availabilityMs: number; cacheStatus: string | null }> {
  const searchMs = await fetchSearch(apiPrefix, token);
  const av = await fetchAvailability(apiPrefix, token);
  return { searchMs, availabilityMs: av.ms, cacheStatus: av.cacheStatus };
}

function failureResult(
  architecture: 'baseline' | 'optimized',
  pairedSessionId: string | null,
  t0: number,
  partial: {
    searchMs: number;
    availabilityMs: number;
    bookingMs: number;
    cacheStatus: string | null;
  },
  err: unknown,
): ArchitectureProbeResult {
  return {
    architecture,
    ok: false,
    pairedSessionId,
    totalMs: performance.now() - t0,
    searchMs: partial.searchMs,
    availabilityMs: partial.availabilityMs,
    bookingMs: partial.bookingMs,
    cacheStatus: partial.cacheStatus,
    bookingStatus: null,
    simulatedPnr: null,
    error: err instanceof Error ? err.message : 'Probe failed',
  };
}

/** Same TC-001 Tatkal case on both stacks: shared warmup, then parallel timed run. */
export async function runPairedTc001CompareProbe(token: string): Promise<{
  pairedSessionId: string;
  baseline: ArchitectureProbeResult;
  optimized: ArchitectureProbeResult;
}> {
  const pairedSessionId = generateShortSessionId();
  const t0 = performance.now();

  await Promise.all([
    warmTc001ReadPath('baseline', '/compare-baseline', token),
    warmTc001ReadPath('optimized', '/compare-optimized', token),
  ]);

  const bKey = `compare-${pairedSessionId}-baseline`;
  const oKey = `compare-${pairedSessionId}-optimized`;

  let baselineRead = { searchMs: 0, availabilityMs: 0, cacheStatus: null as string | null };
  let optimizedRead = { searchMs: 0, availabilityMs: 0, cacheStatus: null as string | null };

  try {
    [baselineRead, optimizedRead] = await Promise.all([
      probeReadPhase('/compare-baseline', token),
      probeReadPhase('/compare-optimized', token),
    ]);
  } catch (err) {
    const fail = failureResult('baseline', pairedSessionId, t0, { ...baselineRead, bookingMs: 0 }, err);
    return {
      pairedSessionId,
      baseline: fail,
      optimized: failureResult('optimized', pairedSessionId, t0, { ...optimizedRead, bookingMs: 0 }, err),
    };
  }

  let optimizedBook = { ms: 0, status: '', simulatedPnr: null as string | null };
  let baselineBook = { ms: 0, status: '', simulatedPnr: null as string | null };

  try {
    optimizedBook = await bookUntilTerminal('/compare-optimized', token, oKey);
    baselineBook = await bookUntilTerminal('/compare-baseline', token, bKey);
  } catch (err) {
    const partial = {
      searchMs: baselineRead.searchMs,
      availabilityMs: baselineRead.availabilityMs,
      bookingMs: baselineBook.ms + optimizedBook.ms,
      cacheStatus: baselineRead.cacheStatus,
    };
    return {
      pairedSessionId,
      baseline: failureResult('baseline', pairedSessionId, t0, partial, err),
      optimized: failureResult(
        'optimized',
        pairedSessionId,
        t0,
        {
          searchMs: optimizedRead.searchMs,
          availabilityMs: optimizedRead.availabilityMs,
          bookingMs: optimizedBook.ms,
          cacheStatus: optimizedRead.cacheStatus,
        },
        err,
      ),
    };
  }

  if (optimizedBook.status !== 'CONFIRMED' || baselineBook.status !== 'CONFIRMED') {
    throw new Error('Paired probe did not confirm both bookings');
  }

  const baselineTotal =
    baselineRead.searchMs + baselineRead.availabilityMs + baselineBook.ms;
  const optimizedTotal =
    optimizedRead.searchMs + optimizedRead.availabilityMs + optimizedBook.ms;

  return {
    pairedSessionId,
    baseline: {
      architecture: 'baseline',
      ok: true,
      pairedSessionId,
      totalMs: baselineTotal,
      searchMs: baselineRead.searchMs,
      availabilityMs: baselineRead.availabilityMs,
      bookingMs: baselineBook.ms,
      cacheStatus: baselineRead.cacheStatus,
      bookingStatus: baselineBook.status,
      simulatedPnr: baselineBook.simulatedPnr,
      error: null,
    },
    optimized: {
      architecture: 'optimized',
      ok: true,
      pairedSessionId,
      totalMs: optimizedTotal,
      searchMs: optimizedRead.searchMs,
      availabilityMs: optimizedRead.availabilityMs,
      bookingMs: optimizedBook.ms,
      cacheStatus: optimizedRead.cacheStatus,
      bookingStatus: optimizedBook.status,
      simulatedPnr: optimizedBook.simulatedPnr,
      error: null,
    },
  };
}

function generateShortSessionId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export type LiveK6Side = {
  requests: number;
  rps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  failedRate: number;
  successRate: number;
  cacheHitCount: number;
  cacheMissCount: number;
  cacheBypassCount: number;
  cacheHitRate: number | null;
};

export type LiveK6CompareResult = {
  ok: boolean;
  runId: string;
  mix: string;
  durationSec: number;
  rate: number;
  generatedAt: string;
  baseline: LiveK6Side;
  optimized: LiveK6Side;
};

export async function fetchCompareK6Status(): Promise<{ k6: boolean; busy: boolean }> {
  const res = await fetch('/__railflux/compare-k6');
  if (!res.ok) return { k6: false, busy: false };
  return (await res.json()) as { k6: boolean; busy: boolean };
}

export async function runLiveK6Compare(token: string): Promise<LiveK6CompareResult> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (typeof window !== 'undefined' && window.location.hostname.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = '1';
  }
  const res = await fetch('/__railflux/compare-k6', {
    method: 'POST',
    headers,
    body: JSON.stringify({ token }),
  });
  const body = (await res.json()) as LiveK6CompareResult & { error?: string };
  if (!res.ok) {
    throw new Error(body.error || `k6 compare failed (${res.status})`);
  }
  return body;
}

export async function checkCompareHealth(apiPrefix: CompareApiPrefix): Promise<boolean> {
  try {
    const res = await fetch(url(apiPrefix, '/health/live'));
    return res.ok;
  } catch {
    return false;
  }
}

/** Keep optimized Redis warm while Compare is open (TTL ~5s). */
export async function prewarmOptimizedAvailabilityCache(token: string): Promise<void> {
  try {
    await warmTc001ReadPath('optimized', '/compare-optimized', token);
  } catch {
    // Best-effort; probe will warm again.
  }
}
