/**
 * M8 #75 — TC-001 simulator API flow (search → availability → book → GET status).
 * Run: M8_SIMULATOR_FLOW_INTEGRATION=1 MYSQL_PORT=3307 npm run test:m8-simulator-flow
 * Requires live API on M8_GATE_BASE_URL (default http://127.0.0.1:3000).
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, describe, test } from 'node:test';
import { signSyntheticJwt, HEADER_IDEMPOTENCY_KEY } from '@railflux/shared';
import {
  TC001_FROM,
  TC001_TO,
  TC001_JOURNEY_DATE,
  TC001_TRAIN_RUN_ID,
  TC001_INVENTORY_3A_ID,
  TC001_USER_ID,
} from '../helpers/tc001-fixture.mjs';

const requireLive = process.env.M8_SIMULATOR_FLOW_INTEGRATION === '1';
const BASE = (process.env.M8_GATE_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const SECRET = process.env.SYNTHETIC_JWT_SECRET ?? 'dev-only-change-me';

describe('M8 simulator flow (integration)', () => {
  let apiUp = false;
  let token;

  before(async () => {
    if (!requireLive) return;
    try {
      const res = await fetch(`${BASE}/health/live`);
      apiUp = res.ok;
    } catch {
      apiUp = false;
    }
    if (apiUp) {
      token = await signSyntheticJwt(SECRET, { userId: TC001_USER_ID });
    }
  });

  function skipUnlessReady(t) {
    if (!requireLive) {
      t.skip('Set M8_SIMULATOR_FLOW_INTEGRATION=1 to run live simulator flow');
      return false;
    }
    if (!apiUp) {
      t.skip(`API not reachable at ${BASE} (start compose:optimized or compose:baseline)`);
      return false;
    }
    return true;
  }

  test('health live', async (t) => {
    if (!skipUnlessReady(t)) return;
    const res = await fetch(`${BASE}/health/live`);
    assert.equal(res.status, 200);
  });

  test('search → availability → book → GET status (TC-001)', async (t) => {
    if (!skipUnlessReady(t)) return;
    const auth = { authorization: `Bearer ${token}` };

    const sq = new URLSearchParams({ from: TC001_FROM, to: TC001_TO, date: TC001_JOURNEY_DATE });
    const search = await fetch(`${BASE}/v1/search?${sq}`, { headers: auth });
    assert.equal(search.status, 200);
    const searchBody = await search.json();
    assert.ok(searchBody.items.some((r) => r.trainRunId === TC001_TRAIN_RUN_ID));
    assert.equal(searchBody.freshness.authoritative, false);

    const avQ = new URLSearchParams({
      trainRunId: TC001_TRAIN_RUN_ID,
      class: '3A',
      quota: 'TATKAL',
    });
    const av = await fetch(`${BASE}/v1/availability?${avQ}`, { headers: auth });
    assert.equal(av.status, 200);
    const avBody = await av.json();
    assert.equal(typeof avBody.displayedSeats, 'number');
    assert.equal(avBody.freshness.authoritative, false);

    const bookBody = {
      userId: TC001_USER_ID,
      inventoryId: TC001_INVENTORY_3A_ID,
      passengers: [{ syntheticName: 'Synthetic Pax', age: 30 }],
      paymentToken: 'stub-payment-token',
    };

    let idem = `m8-gate-${randomUUID()}`;
    /** @type {Response} */
    let bookRes;
    /** @type {{ status?: string; bookingId?: string; simulatedPnr?: string }} */
    let bookJson;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      bookRes = await fetch(`${BASE}/v1/bookings`, {
        method: 'POST',
        headers: {
          ...auth,
          'content-type': 'application/json',
          [HEADER_IDEMPOTENCY_KEY]: idem,
        },
        body: JSON.stringify(bookBody),
      });
      bookJson = await bookRes.json();
      if (bookRes.status === 201 && bookJson.status === 'CONFIRMED') break;
      if (bookRes.status === 422 && bookJson.errorCode === 'PAYMENT_FAILED') {
        idem = `m8-gate-${randomUUID()}`;
        continue;
      }
      break;
    }

    assert.equal(bookRes.status, 201);
    assert.equal(bookJson.status, 'CONFIRMED');
    assert.match(bookJson.simulatedPnr ?? '', /^RF[0-9]{10}$/);

    const getRes = await fetch(`${BASE}/v1/bookings/${bookJson.bookingId}`, { headers: auth });
    assert.equal(getRes.status, 200);
    const getJson = await getRes.json();
    assert.deepEqual(getJson.bookingId, bookJson.bookingId);
    assert.equal(getJson.status, 'CONFIRMED');
  });
});
