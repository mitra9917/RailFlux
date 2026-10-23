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

function tunnelHeaders(headers: Headers): void {
  if (typeof window === 'undefined') return;
  const host = window.location.hostname;
  if (host.includes('ngrok') || host.endsWith('.ngrok-free.dev')) {
    // Free ngrok interstitials stall XHR/fetch unless this is set.
    headers.set('ngrok-skip-browser-warning', '1');
  }
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const url = buildUrl(path);
  const headers = new Headers(options.headers);
  tunnelHeaders(headers);

  if (options.auth !== false) {
    const token = loadStoredToken();
    if (!token) {
      throw new ApiError('Sign in with a synthetic user first.', 401);
    }
    headers.set('Authorization', `Bearer ${token}`);
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15000);
  if (options.signal) {
    options.signal.addEventListener('abort', () => ac.abort(), { once: true });
  }

  try {
    const res = await fetch(url, { ...options, headers, signal: ac.signal });
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('Search timed out. On ngrok, hard-refresh after Visit Site, or use localhost.', 408);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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

  if (typeof body === 'string' && body.includes('ngrok')) {
    throw new ApiError(
      'ngrok blocked the API request. Click Visit Site on the warning page, then refresh.',
      res.status || 403,
    );
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
