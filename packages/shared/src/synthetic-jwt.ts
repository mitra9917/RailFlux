import * as jose from 'jose';
import { RailFluxError } from './errors.js';

/** Claims carried in locally issued synthetic JWTs (no real IRCTC credentials). */
export type SyntheticAuthContext = {
  userId: string;
  cohort?: string;
};

export const SYNTHETIC_JWT_ISSUER = 'railflux-synthetic';
export const SYNTHETIC_JWT_ALGORITHM = 'HS256';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unauthorized(message = 'Missing or invalid bearer token'): RailFluxError {
  return new RailFluxError('UNAUTHORIZED', message, 401);
}

function parseClaims(payload: jose.JWTPayload): SyntheticAuthContext {
  const sub = payload.sub;
  if (typeof sub !== 'string' || !UUID_RE.test(sub)) {
    throw unauthorized();
  }
  const cohort = payload.cohort;
  if (cohort !== undefined && (typeof cohort !== 'string' || cohort.length > 32)) {
    throw unauthorized();
  }
  return cohort === undefined ? { userId: sub } : { userId: sub, cohort };
}

export async function verifySyntheticJwt(
  token: string,
  secret: string,
): Promise<SyntheticAuthContext> {
  if (!token.trim()) {
    throw unauthorized();
  }
  const key = new TextEncoder().encode(secret);
  try {
    const { payload } = await jose.jwtVerify(token, key, {
      algorithms: [SYNTHETIC_JWT_ALGORITHM],
      issuer: SYNTHETIC_JWT_ISSUER,
    });
    return parseClaims(payload);
  } catch (err) {
    if (err instanceof RailFluxError) {
      throw err;
    }
    throw unauthorized();
  }
}

export async function signSyntheticJwt(
  secret: string,
  auth: SyntheticAuthContext,
  expiresInSec = 3600,
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  const builder = new jose.SignJWT({
    ...(auth.cohort ? { cohort: auth.cohort } : {}),
  })
    .setProtectedHeader({ alg: SYNTHETIC_JWT_ALGORITHM })
    .setSubject(auth.userId)
    .setIssuer(SYNTHETIC_JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${expiresInSec}s`);

  return builder.sign(key);
}
