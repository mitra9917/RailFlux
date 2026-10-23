import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(import.meta.dirname, '..');
const frontend = join(root, 'frontend');

test('M8 #73 bookings API sends Idempotency-Key and handles polling', () => {
  const src = readFileSync(join(frontend, 'src/api/bookings.ts'), 'utf8');
  assert.match(src, /Idempotency-Key/);
  assert.match(src, /425/);
  assert.match(src, /pollBookingUntilTerminal/);
  assert.match(src, /\/v1\/bookings/);
});

test('M8 #73 idempotency key generator meets OpenAPI length', () => {
  const src = readFileSync(join(frontend, 'src/lib/idempotency-key.ts'), 'utf8');
  assert.match(src, /16/);
  assert.match(src, /128/);
});

test('M8 #73 book and status routes exist', () => {
  const app = readFileSync(join(frontend, 'src/App.tsx'), 'utf8');
  assert.match(app, /path="book"/);
  assert.match(app, /bookings\/:bookingId/);
});

test('M8 #73 advisory banner on book flow', () => {
  const book = readFileSync(join(frontend, 'src/pages/BookPage.tsx'), 'utf8');
  assert.match(book, /AdvisoryBanner/);
  assert.match(book, /idempotencyKey/);
});

test('pay page wires approve and decline stubs; status retries FAILED', () => {
  const pay = readFileSync(join(frontend, 'src/pages/PayPage.tsx'), 'utf8');
  const status = readFileSync(join(frontend, 'src/pages/BookingStatusPage.tsx'), 'utf8');
  assert.match(pay, /DEMO_PAYMENT_SUCCESS_TOKEN/);
  assert.match(pay, /DEMO_PAYMENT_FAIL_TOKEN/);
  assert.match(status, /FAILED/);
  assert.match(status, /Retry payment/);
  assert.match(status, /payHrefFromJourney/);
});

test('confirmed booking and architecture replay the seat rush', () => {
  const status = readFileSync(join(frontend, 'src/pages/BookingStatusPage.tsx'), 'utf8');
  const architecture = readFileSync(join(frontend, 'src/pages/ArchitecturePage.tsx'), 'utf8');
  const rush = readFileSync(join(frontend, 'src/components/architecture/TrafficRush.tsx'), 'utf8');
  assert.match(status, /TrafficRush/);
  assert.match(architecture, /TrafficRush/);
  assert.match(rush, /AWS WAF/);
  assert.match(rush, /not an idempotency mismatch/);
});
