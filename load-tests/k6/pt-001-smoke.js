/**
 * PT-001 smoke — 1–5 RPS open-model mix (health + search). M6 #56.
 *
 * Env: BASE_URL, K6_BEARER_TOKEN, RUN_ID, PT001_RATE (default 3), PT001_DURATION (default 30s).
 */
import http from 'k6/http';
import { check } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const token = __ENV.K6_BEARER_TOKEN || '';
const runId = __ENV.RUN_ID || 'pt001-smoke';
const rate = Math.min(5, Math.max(1, Number(__ENV.PT001_RATE || 3)));
const duration = __ENV.PT001_DURATION || '30s';

/** @see tests/helpers/tc001-fixture.mjs */
const searchQuery = { from: 'SAB', to: 'SAA', date: '2026-04-01' };

export const options = {
  scenarios: {
    pt001_smoke: {
      executor: 'constant-arrival-rate',
      rate,
      timeUnit: '1s',
      duration,
      preAllocatedVUs: 10,
      maxVUs: 30,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.95'],
  },
};

function headers() {
  const h = { 'X-Run-Id': runId };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export default function pt001Smoke() {
  const roll = Math.random();
  if (roll < 0.15) {
    const res = http.get(`${baseUrl}/health/live`, { headers: headers(), tags: { op: 'live' } });
    check(res, { 'live 200': (r) => r.status === 200 });
    return;
  }
  if (roll < 0.25) {
    const res = http.get(`${baseUrl}/health/ready`, { headers: headers(), tags: { op: 'ready' } });
    check(res, { 'ready 200': (r) => r.status === 200 });
    return;
  }
  const q = searchQuery;
  const path = `/v1/search?from=${q.from}&to=${q.to}&date=${q.date}`;
  const res = http.get(`${baseUrl}${path}`, { headers: headers(), tags: { op: 'search' } });
  check(res, {
    'search 200': (r) => r.status === 200,
    'search items array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.items);
      } catch {
        return false;
      }
    },
  });
}
