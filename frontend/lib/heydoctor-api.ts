/**
 * URL base del API HeyDoctor (Nest) y JWT stateless.
 * No usar NextAuth ni rutas tipo `/api/auth/csrf` en el origen de Next.
 *
 * `heydoctorFetch`: peticiones con `credentials: 'include'`, Bearer si hay token en
 * `localStorage`, y ante 401 una sola ronda de refresh deduplicado (evita “refresh storms”).
 */

import { apiCredentialsInit } from './api-credentials';

export const HEYDOCTOR_ACCESS_TOKEN_STORAGE_KEY = 'heydoctor_access_token';

export type HeydoctorWindow = Window & { __API_URL__?: string };

export function getHeydoctorApiBase(): string {
  if (typeof window !== 'undefined') {
    const w = window as HeydoctorWindow;
    if (w.__API_URL__) return w.__API_URL__;
  }
  return (
    process.env.NEXT_PUBLIC_HEYDOCTOR_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ''
  );
}

export function requireHeydoctorApiBase(): string {
  const base = getHeydoctorApiBase();
  if (!base) {
    throw new Error(
      'NEXT_PUBLIC_HEYDOCTOR_API_URL or NEXT_PUBLIC_API_URL must be configured',
    );
  }
  return base;
}

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(HEYDOCTOR_ACCESS_TOKEN_STORAGE_KEY);
}

export function setStoredAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HEYDOCTOR_ACCESS_TOKEN_STORAGE_KEY, token);
}

export function clearStoredAccessToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(HEYDOCTOR_ACCESS_TOKEN_STORAGE_KEY);
}

export function requireAccessToken(): string {
  const token = getStoredAccessToken();
  if (!token) {
    throw new Error('No auth token available');
  }
  return token;
}

/** Headers para rutas protegidas del Nest (JwtAuthGuard). */
export function requireBearerHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const token = requireAccessToken();
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const base = requireHeydoctorApiBase();
  const res = await fetch(`${base}/api/auth/refresh`, {
    method: 'POST',
    ...apiCredentialsInit,
    headers: {
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    clearStoredAccessToken();
    return false;
  }
  const data = (await res.json()) as { access_token?: string };
  if (typeof data.access_token === 'string' && data.access_token.length > 0) {
    setStoredAccessToken(data.access_token);
    return true;
  }
  clearStoredAccessToken();
  return false;
}

/** Una sola petición de refresh concurrente por pestaña; el resto espera la misma promesa. */
function dedupedRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function mergeHeydoctorInit(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  const token = getStoredAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return {
    ...init,
    ...apiCredentialsInit,
    credentials: 'include',
    headers,
  };
}

/**
 * `fetch` al API Nest con cookies + Bearer; si la respuesta es 401, intenta refresh
 * (deduplicado) y reintenta la misma petición una vez.
 */
export async function heydoctorFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const first = await fetch(input, mergeHeydoctorInit(init));
  if (first.status !== 401) {
    return first;
  }
  const refreshed = await dedupedRefresh();
  if (!refreshed) {
    return first;
  }
  return fetch(input, mergeHeydoctorInit(init));
}
