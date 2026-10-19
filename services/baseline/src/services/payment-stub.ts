import {
  PaymentStubSequence,
  authorizePaymentStub,
  type PaymentStubConfig,
  type PaymentStubOutcome,
} from '@railflux/shared';
import { getPaymentStubConfig } from '../payment-stub-config.js';

let runSequence: PaymentStubSequence | null = null;

/** Process-wide sequence; call `resetPaymentStubRun()` at experiment reset. */
export function getPaymentStubRunSequence(config?: PaymentStubConfig): PaymentStubSequence {
  const cfg = config ?? getPaymentStubConfig();
  if (!runSequence) {
    runSequence = new PaymentStubSequence(cfg);
  }
  return runSequence;
}

export function resetPaymentStubRun(): void {
  runSequence?.reset();
  runSequence = null;
}

export async function authorizePayment(
  attemptIndex: number,
  options?: { skipDelay?: boolean; config?: PaymentStubConfig },
): Promise<PaymentStubOutcome> {
  const config = options?.config ?? getPaymentStubConfig();
  return authorizePaymentStub(config, attemptIndex, options);
}
