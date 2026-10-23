/**
 * Short paired compare burst — same PT-005 mix, seconds not minutes.
 * Env: BASE_URL, K6_BEARER_TOKEN, RUN_ID, LOAD_RATE (default 12), LOAD_DURATION (default 8s).
 */
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { TC001, authHeaders, bookingPostOptions, fixtureUserId } from './lib/railflux-data.js';

const cacheHits = new Counter('cache_hits');
const cacheMisses = new Counter('cache_misses');
const cacheBypass = new Counter('cache_bypass');

const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const token = __ENV.K6_BEARER_TOKEN || '';
const runId = __ENV.RUN_ID || 'compare-burst';
const rate = Math.max(4, Number(__ENV.LOAD_RATE || 12));
const duration = __ENV.LOAD_DURATION || '8s';

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    compare_burst: {
      executor: 'constant-arrival-rate',
      rate,
      timeUnit: '1s',
      duration,
      preAllocatedVUs: Math.max(20, rate * 3),
      maxVUs: Math.max(40, rate * 6),
    },
  },
  thresholds: {},
};

function headers() {
  return {
    ...authHeaders(token, runId),
    'X-Railflux-Compare-Probe': '1',
  };
}

function idemKey() {
  return `k6-${__VU}-${__ITER}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function noteCache(body) {
  try {
    const status = JSON.parse(body)?.freshness?.cacheStatus;
    if (status === 'HIT') cacheHits.add(1);
    else if (status === 'MISS') cacheMisses.add(1);
    else if (status === 'BYPASS') cacheBypass.add(1);
  } catch {
    // ignore
  }
}

export default function compareBurst() {
  const roll = Math.random();
  const hdrs = headers();

  if (roll < 0.7) {
    const path = `/v1/search?from=${TC001.from}&to=${TC001.to}&date=${TC001.journeyDate}`;
    const res = http.get(`${baseUrl}${path}`, { headers: hdrs, tags: { op: 'search' } });
    check(res, { 'search ok': (r) => r.status === 200 });
    return;
  }

  if (roll < 0.9) {
    const path = `/v1/availability?trainRunId=${TC001.trainRunId}&class=3A&quota=TATKAL`;
    const res = http.get(`${baseUrl}${path}`, { headers: hdrs, tags: { op: 'availability' } });
    check(res, { 'availability ok': (r) => r.status === 200 });
    if (res.status === 200) noteCache(res.body);
    return;
  }

  const body = JSON.stringify({
    userId: fixtureUserId(),
    inventoryId: TC001.inventory3aId,
    passengers: [{ syntheticName: 'Compare Burst Pax', age: 30 }],
    paymentToken: 'stub-payment-token',
  });
  const res = http.post(
    `${baseUrl}/v1/bookings`,
    body,
    bookingPostOptions({ ...hdrs, 'Idempotency-Key': idemKey() }),
  );
  check(res, {
    'booking terminal': (r) => [200, 201, 409, 422, 425].includes(r.status),
  });
}
