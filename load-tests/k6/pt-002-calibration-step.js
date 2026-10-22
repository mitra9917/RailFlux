/**
 * PT-002 calibration step — 70/20/10 open-model mix at one offered rate (M7 #63).
 *
 * Env: BASE_URL, K6_BEARER_TOKEN, RUN_ID, PT002_RATE, PT002_STEP_DURATION (default 60s).
 */
import http from 'k6/http';
import { check } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { TC001, authHeaders, bookingPostOptions, fixtureUserId } from './lib/railflux-data.js';

const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const token = __ENV.K6_BEARER_TOKEN || '';
const runId = __ENV.RUN_ID || 'pt002';
const rate = Math.max(1, Number(__ENV.PT002_RATE || 5));
const duration = __ENV.PT002_STEP_DURATION || '60s';

export const options = {
  scenarios: {
    pt002_calibration: {
      executor: 'constant-arrival-rate',
      rate,
      timeUnit: '1s',
      duration,
      preAllocatedVUs: Math.max(20, rate * 5),
      maxVUs: Math.max(60, rate * 12),
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.15'],
    checks: ['rate>0.85'],
  },
};

export default function pt002CalibrationStep() {
  const roll = Math.random();
  const hdrs = authHeaders(token, runId);
  if (roll < 0.7) {
    const path = `/v1/search?from=${TC001.from}&to=${TC001.to}&date=${TC001.journeyDate}`;
    const res = http.get(`${baseUrl}${path}`, { headers: hdrs, tags: { op: 'search' } });
    check(res, { 'search ok': (r) => r.status === 200 });
    return;
  }
  if (roll < 0.9) {
    const path =
      `/v1/availability?trainRunId=${TC001.trainRunId}&class=3A&quota=TATKAL&date=${TC001.journeyDate}`;
    const res = http.get(`${baseUrl}${path}`, { headers: hdrs, tags: { op: 'availability' } });
    check(res, { 'availability ok': (r) => r.status === 200 });
    return;
  }
  const body = JSON.stringify({
    userId: fixtureUserId(),
    inventoryId: TC001.inventory3aId,
    passengers: [{ syntheticName: 'PT002 Pax', age: 30 }],
    paymentToken: 'stub-payment-token',
  });
  const res = http.post(
    `${baseUrl}/v1/bookings`,
    body,
    bookingPostOptions({ ...hdrs, 'Idempotency-Key': uuidv4() }),
  );
  check(res, {
    'booking terminal': (r) => [200, 201, 409, 422].includes(r.status),
  });
}
