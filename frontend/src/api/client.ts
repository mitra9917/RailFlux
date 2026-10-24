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

function isLocalDevHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function isSharedTunnelHost(hostname: string): boolean {
  if (isLocalDevHost(hostname)) return false;
  return (
    hostname.includes('ngrok') ||
    hostname.endsWith('.ngrok-free.dev') ||
    hostname.endsWith('.ngrok-free.app') ||
    hostname.endsWith('.ngrok.app') ||
    hostname.endsWith('.ngrok.io')
  );
}

function tunnelHeaders(headers: Headers): void {
  if (typeof window === 'undefined') return;
  const host = window.location.hostname;
  // Shared tunnels (ngrok, etc.): skip interstitial on API fetches too.
  if (isSharedTunnelHost(host) || !isLocalDevHost(host)) {
    headers.set('ngrok-skip-browser-warning', '1');
  }
}

function assertTunnelSafeApiUrl(url: string): void {
  if (typeof window === 'undefined') return;
  if (isLocalDevHost(window.location.hostname)) return;
  if (!url.startsWith('http')) return;
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(url)) {
    throw new ApiError(
      'This build points API calls at your laptop (VITE_API_BASE_URL). Rebuild with empty base URL and use npm run share:frontend for ngrok.',
      0,
    );
  }
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const url = buildUrl(path);
  assertTunnelSafeApiUrl(url);
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
  const timeoutMs =
    typeof window !== 'undefined' && isSharedTunnelHost(window.location.hostname) ? 30000 : 15000;
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  if (options.signal) {
    options.signal.addEventListener('abort', () => ac.abort(), { once: true });
  }

  try {
    const res = await fetch(url, { ...options, headers, signal: ac.signal });
    return res;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(
        'Request timed out. On ngrok: Visit Site once, hard-refresh, mint JWT on Home, ensure Docker API is on :3000 and Vite preview on :5173.',
        408,
      );
    }
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new ApiError(
      `${msg}. For ngrok: run npm run compare:dual-stack (or compose:baseline), npm run share:frontend, mint JWT on this URL (not localhost).`,
      0,
    );
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
