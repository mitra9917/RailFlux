const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DEFAULT_SYNTHETIC_USER_ID = '11111111-1111-4111-8111-111111111111';

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!raw) {
    throw new Error('Set VITE_API_BASE_URL (see frontend/.env.example).');
  }
  return raw.replace(/\/$/, '');
}

/** Origin for unauthenticated health probes (`/health/live`). */
export function getApiOrigin(): string {
  const base = getApiBaseUrl();
  if (base.endsWith('/api')) {
    return base.slice(0, -4);
  }
  return base;
}

export function getSyntheticUserId(): string {
  const raw = import.meta.env.VITE_SYNTHETIC_USER_ID?.trim() || DEFAULT_SYNTHETIC_USER_ID;
  if (!UUID_RE.test(raw)) {
    throw new Error('VITE_SYNTHETIC_USER_ID must be a UUID.');
  }
  return raw;
}

export function getDevJwtSecret(): string | null {
  const secret = import.meta.env.VITE_SYNTHETIC_JWT_SECRET?.trim();
  return secret || null;
}
