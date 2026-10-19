import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_PAYMENT_STUB_CONFIG,
  parsePaymentStubConfig,
  type PaymentStubConfig,
} from '@railflux/shared';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

let cached: PaymentStubConfig | null = null;

/** Load payment stub settings from fixture manifest (cached). */
export function getPaymentStubConfig(): PaymentStubConfig {
  if (cached) return cached;
  const manifestPath = process.env.FIXTURE_MANIFEST
    ? path.resolve(process.env.FIXTURE_MANIFEST)
    : path.join(repoRoot, 'experiment/fixtures/manifest.yaml');
  try {
    cached = parsePaymentStubConfig(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    cached = DEFAULT_PAYMENT_STUB_CONFIG;
  }
  return cached;
}

export function resetPaymentStubConfigCache(): void {
  cached = null;
}
