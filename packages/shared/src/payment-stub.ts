import type { PaymentStubConfig } from './payment-stub-config.js';

export type PaymentStubOutcome = {
  success: boolean;
  delayMs: number;
  /** Stored on `payments.stub_sequence`; deterministic per seed + attempt index. */
  stubSequence: string;
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive RNG stream for one payment attempt (stable for seed + index). */
function rngForAttempt(paymentSequenceSeed: number, attemptIndex: number): () => number {
  const rng = mulberry32((paymentSequenceSeed ^ Math.imul(attemptIndex, 0x9e3779b1)) >>> 0);
  return rng;
}

/**
 * Deterministic authorize outcome for the Nth payment in an experiment run.
 * Same `PaymentStubConfig` + `attemptIndex` always yields the same result (parity across profiles).
 */
export function derivePaymentStubOutcome(
  config: PaymentStubConfig,
  attemptIndex: number,
): PaymentStubOutcome {
  if (attemptIndex < 0 || !Number.isInteger(attemptIndex)) {
    throw new Error('attemptIndex must be a non-negative integer');
  }
  const rng = rngForAttempt(config.paymentSequenceSeed, attemptIndex);
  const failRoll = rng();
  const jitterRoll = rng();
  const success = failRoll >= config.failureRate;
  const jitter =
    config.jitterMs > 0 ? Math.floor(jitterRoll * (config.jitterMs + 1)) : 0;
  const delayMs = config.baseDelayMs + jitter;
  return {
    success,
    delayMs,
    stubSequence: `${config.paymentSequenceSeed}:${attemptIndex}`,
  };
}

/** Run-scoped counter for sequential payment attempts (reset between experiment runs). */
export class PaymentStubSequence {
  private attemptIndex = 0;

  constructor(private readonly config: PaymentStubConfig) {}

  reset(): void {
    this.attemptIndex = 0;
  }

  nextOutcome(): PaymentStubOutcome {
    const outcome = derivePaymentStubOutcome(this.config, this.attemptIndex);
    this.attemptIndex += 1;
    return outcome;
  }
}

export async function authorizePaymentStub(
  config: PaymentStubConfig,
  attemptIndex: number,
  options?: { skipDelay?: boolean },
): Promise<PaymentStubOutcome> {
  const outcome = derivePaymentStubOutcome(config, attemptIndex);
  if (!options?.skipDelay && outcome.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, outcome.delayMs));
  }
  return outcome;
}
