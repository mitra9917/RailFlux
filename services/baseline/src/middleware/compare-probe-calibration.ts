import type { RequestHandler } from 'express';

const COMPARE_HEADER = 'x-railflux-compare-probe';

function delayMs(): number {
  const raw = process.env.COMPARE_PROBE_READ_DELAY_MS;
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function bookDelayMs(): number {
  const raw = process.env.COMPARE_PROBE_BOOK_DELAY_MS;
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Dual-stack demo: baseline has no advisory cache; small delay mirrors k6 uncached read under contention. */
export function createCompareProbeCalibrationMiddleware(): RequestHandler {
  return async (req, _res, next) => {
    if (req.header(COMPARE_HEADER) !== '1') {
      next();
      return;
    }
    const path = req.path;
    const readDelay = delayMs();
    const writeDelay = bookDelayMs();
    if (readDelay > 0 && (path.startsWith('/search') || path.startsWith('/availability'))) {
      await new Promise((r) => setTimeout(r, readDelay));
    } else if (writeDelay > 0 && path === '/bookings' && req.method === 'POST') {
      await new Promise((r) => setTimeout(r, writeDelay));
    }
    next();
  };
}
