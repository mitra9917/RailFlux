/**
 * PT-006 — oversubscribed shared inventory (heavy booking). M6 #57.
 * Use with manifest experiment.inventory_profile: contention.
 */
import http from 'k6/http';
import { check } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { TC001, authHeaders } from './lib/railflux-data.js';

const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const token = __ENV.K6_BEARER_TOKEN || '';
const runId = __ENV.RUN_ID || 'pt006';
const rate = Number(__ENV.LOAD_RATE || 8);
const duration = __ENV.LOAD_DURATION || '180s';

export const options = {
  scenarios: {
    pt006_contention: {
      executor: 'constant-arrival-rate',
      rate,
      timeUnit: '1s',
      duration,
      preAllocatedVUs: Math.max(30, rate * 8),
      maxVUs: Math.max(80, rate * 15),
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.25'],
    checks: ['rate>0.80'],
  },
};

export default function pt006Contention() {
  const roll = Math.random();
  const hdrs = authHeaders(token, runId);
  // 30% read path, 70% booking attempts on the same hot inventory row.
  if (roll < 0.15) {
    const path = `/v1/search?from=${TC001.from}&to=${TC001.to}&date=${TC001.journeyDate}`;
    const res = http.get(`${baseUrl}${path}`, { headers: hdrs, tags: { op: 'search' } });
    check(res, { 'search ok': (r) => r.status === 200 });
    return;
  }
  if (roll < 0.3) {
    const path =
      `/v1/availability?trainRunId=${TC001.trainRunId}&class=3A&quota=TATKAL&date=${TC001.journeyDate}`;
    const res = http.get(`${baseUrl}${path}`, { headers: hdrs, tags: { op: 'availability' } });
    check(res, { 'availability ok': (r) => r.status === 200 });
    return;
  }
  const body = JSON.stringify({
    userId: TC001.userId,
    inventoryId: TC001.inventory3aId,
    passengers: [{ syntheticName: 'PT006 Pax', age: 30 }],
    paymentToken: 'stub-payment-token',
  });
  const res = http.post(`${baseUrl}/v1/bookings`, body, {
    headers: { ...hdrs, 'Idempotency-Key': uuidv4() },
    tags: { op: 'booking' },
  });
  check(res, {
    'booking outcome': (r) => [200, 201, 409, 422, 429].includes(r.status),
  });
}
