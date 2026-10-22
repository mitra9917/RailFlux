import { getApiBaseUrl, getApiOrigin } from '../config/env';
import { loadStoredToken } from '../auth/synthetic-auth';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ApiFetchOptions = RequestInit & {
  auth?: boolean;
};

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const base = getApiBaseUrl();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(options.headers);

  if (options.auth !== false) {
    const token = loadStoredToken();
    if (!token) {
      throw new ApiError('Sign in with a synthetic user first.', 401);
    }
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, { ...options, headers });
}

export async function fetchLiveHealth(): Promise<{ ok: boolean; status: number }> {
  const origin = getApiOrigin();
  const res = await fetch(`${origin}/health/live`);
  return { ok: res.ok, status: res.status };
}
