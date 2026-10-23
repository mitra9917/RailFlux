import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  DEFAULT_PAYMENT_STUB_CONFIG,
  PAYMENT_TOKEN_FORCE_FAIL,
  PAYMENT_TOKEN_FORCE_SUCCESS,
  PAYMENT_TOKEN_LIVE,
  PaymentStubSequence,
  derivePaymentStubOutcome,
  parsePaymentStubConfig,
  paymentOutcomeOverride,
} from '@railflux/shared';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'experiment/fixtures/manifest.yaml');

test('parsePaymentStubConfig reads fixture manifest payment_stub block', () => {
  const config = parsePaymentStubConfig(fs.readFileSync(manifestPath, 'utf8'));
  assert.deepEqual(config, DEFAULT_PAYMENT_STUB_CONFIG);
});

test('derivePaymentStubOutcome is stable for same seed and attempt index', () => {
  const a = derivePaymentStubOutcome(DEFAULT_PAYMENT_STUB_CONFIG, 7);
  const b = derivePaymentStubOutcome(DEFAULT_PAYMENT_STUB_CONFIG, 7);
  assert.deepEqual(a, b);
  assert.match(a.stubSequence, /^481516:7$/);
  assert.equal(a.delayMs >= 100 && a.delayMs <= 125, true);
});

test('different payment sequence seeds change outcomes at same attempt index', () => {
  const base = derivePaymentStubOutcome(DEFAULT_PAYMENT_STUB_CONFIG, 12);
  const other = derivePaymentStubOutcome(
    { ...DEFAULT_PAYMENT_STUB_CONFIG, paymentSequenceSeed: 481517 },
    12,
  );
  assert.notDeepEqual(base, other);
});

test('PaymentStubSequence advances attempt index deterministically', () => {
  const seq = new PaymentStubSequence(DEFAULT_PAYMENT_STUB_CONFIG);
  const first = seq.nextOutcome();
  const second = seq.nextOutcome();
  assert.deepEqual(first, derivePaymentStubOutcome(DEFAULT_PAYMENT_STUB_CONFIG, 0));
  assert.deepEqual(second, derivePaymentStubOutcome(DEFAULT_PAYMENT_STUB_CONFIG, 1));
  seq.reset();
  assert.deepEqual(seq.nextOutcome(), first);
});

test('pinned failure count for first 500 attempts matches manifest failure_rate', () => {
  let failures = 0;
  for (let i = 0; i < 500; i += 1) {
    if (!derivePaymentStubOutcome(DEFAULT_PAYMENT_STUB_CONFIG, i).success) failures += 1;
  }
  assert.equal(failures, 15);
});

test('demo payment tokens force pass or fail without using the live sequence', () => {
  assert.equal(paymentOutcomeOverride(PAYMENT_TOKEN_LIVE), null);
  assert.equal(paymentOutcomeOverride(PAYMENT_TOKEN_FORCE_FAIL)?.success, false);
  assert.equal(paymentOutcomeOverride(PAYMENT_TOKEN_FORCE_SUCCESS)?.success, true);
});
