#!/usr/bin/env node
/**
 * Mint a synthetic JWT for local curl/k6 (never a real IRCTC credential).
 * Usage: node scripts/mint-synthetic-jwt.mjs <user-uuid> [cohort]
 */
import { signSyntheticJwt } from '@railflux/shared';

const userId = process.argv[2];
const cohort = process.argv[3];
const secret = process.env.SYNTHETIC_JWT_SECRET ?? 'dev-only-change-me';

if (!userId) {
  console.error('usage: SYNTHETIC_JWT_SECRET=... node scripts/mint-synthetic-jwt.mjs <user-uuid> [cohort]');
  process.exit(1);
}

const token = await signSyntheticJwt(secret, cohort ? { userId, cohort } : { userId });
console.log(token);
