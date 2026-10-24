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

/** Path after `/v1` mount (Express may still expose `/v1/search` on req.path). */
export function compareProbeRouteKind(
  path: string,
  method: string,
): 'read' | 'book' | null {
  const p = path.startsWith('/v1/') ? path.slice(3) : path;
  if (p.startsWith('/search') || p.startsWith('/availability')) return 'read';
  if (method === 'POST' && p.startsWith('/bookings')) return 'book';
  return null;
}

/** Dual-stack demo: baseline has no advisory cache; delay mirrors uncached primary-DB reads under Tatkal contention. */
export function createCompareProbeCalibrationMiddleware(): RequestHandler {
  return async (req, _res, next) => {
    if (req.header(COMPARE_HEADER) !== '1') {
      next();
      return;
    }
    const kind = compareProbeRouteKind(req.path, req.method);
    const readDelay = delayMs();
    const writeDelay = bookDelayMs();
    if (kind === 'read' && readDelay > 0) {
      await new Promise((r) => setTimeout(r, readDelay));
    } else if (kind === 'book' && writeDelay > 0) {
      await new Promise((r) => setTimeout(r, writeDelay));
    }
    next();
  };
}
