import type { ErrorResponse } from '@railflux/shared/api-types';
import { getApiBaseUrl } from '../config/env';
import { loadStoredToken } from '../auth/synthetic-auth';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
    readonly errorCode?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ApiFetchOptions = RequestInit & {
  auth?: boolean;
};

function buildUrl(path: string): string {
  const base = getApiBaseUrl();
  if (path.startsWith('http')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const url = buildUrl(path);
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

export async function parseApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  /** @type {unknown} */
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const errBody = body as Partial<ErrorResponse> | null;
    const message =
      errBody && typeof errBody.message === 'string'
        ? errBody.message
        : `Request failed (${res.status})`;
    const errorCode =
      errBody && typeof errBody.errorCode === 'string' ? errBody.errorCode : undefined;
    throw new ApiError(message, res.status, body, errorCode);
  }

  return body as T;
}

export async function fetchLiveHealth(): Promise<{ ok: boolean; status: number }> {
  const res = await apiFetch('/health/live', { auth: false });
  return { ok: res.ok, status: res.status };
}
