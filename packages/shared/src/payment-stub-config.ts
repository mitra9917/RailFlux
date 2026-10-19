/** Matches `payment_stub` and `seeds.payment_sequence` in experiment/fixtures/manifest.yaml. */
export type PaymentStubConfig = {
  paymentSequenceSeed: number;
  baseDelayMs: number;
  jitterMs: number;
  /** Fraction in [0, 1); payment fails when derived roll is below this value. */
  failureRate: number;
};

/** Pinned values from fixture `railflux-tatkal-v1` (do not drift without manifest change). */
export const DEFAULT_PAYMENT_STUB_CONFIG: PaymentStubConfig = {
  paymentSequenceSeed: 481516,
  baseDelayMs: 100,
  jitterMs: 25,
  failureRate: 0.02,
};

function pickInt(text: string, pattern: RegExp, label: string): number {
  const m = text.match(pattern);
  if (!m) throw new Error(`manifest missing ${label}`);
  return parseInt(m[1], 10);
}

function pickFloat(text: string, pattern: RegExp, label: string): number {
  const m = text.match(pattern);
  if (!m) throw new Error(`manifest missing ${label}`);
  return parseFloat(m[1]);
}

export function parsePaymentStubConfig(manifestText: string): PaymentStubConfig {
  const normalized = manifestText.replace(/\r\n/g, '\n');
  return {
    paymentSequenceSeed: pickInt(
      normalized,
      /^  payment_sequence:\s*(\d+)/m,
      'seeds.payment_sequence',
    ),
    baseDelayMs: pickInt(normalized, /^  base_delay_ms:\s*(\d+)/m, 'payment_stub.base_delay_ms'),
    jitterMs: pickInt(normalized, /^  jitter_ms:\s*(\d+)/m, 'payment_stub.jitter_ms'),
    failureRate: pickFloat(
      normalized,
      /^  failure_rate:\s*(\d+(?:\.\d+)?)/m,
      'payment_stub.failure_rate',
    ),
  };
}
