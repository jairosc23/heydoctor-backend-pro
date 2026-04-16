/**
 * URL base del API HeyDoctor (Nest) y JWT stateless.
 * No usar NextAuth ni rutas tipo `/api/auth/csrf` en el origen de Next.
 *
 * `heydoctorFetch`: peticiones con `credentials: 'include'`, Bearer si hay token en
 * `localStorage`, y ante 401 una sola ronda de refresh deduplicado (evita “refresh storms”).
 * Cabecera interna `x-hd-retried: 1` en el reintento evita bucles si el 401 persiste.
 */

import { apiCredentialsInit } from './api-credentials';

const HEADER_HD_RETRIED = 'x-hd-retried';
const HEYDOCTOR_FETCH_TIMEOUT_MS = 8_000;

function withFetchTimeout(
  init: RequestInit | undefined,
  ms: number,
): { init: RequestInit; clearTimer: () => void } {
  const timeoutCtrl = new AbortController();
  const timer = setTimeout(() => timeoutCtrl.abort(), ms);
  const clearTimer = () => clearTimeout(timer);
  const userSignal = init?.signal;
  let signal: AbortSignal;

  if (userSignal) {
    const combine =
      typeof AbortSignal !== 'undefined'
        ? (
            AbortSignal as typeof AbortSignal & {
              any?: (signals: AbortSignal[]) => AbortSignal;
            }
          ).any
        : undefined;
    if (typeof combine === 'function') {
      signal = combine([userSignal, timeoutCtrl.signal]);
    } else {
      const merged = new AbortController();
      const onAbort = () => {
        clearTimer();
        merged.abort();
      };
      userSignal.addEventListener('abort', onAbort, { once: true });
      timeoutCtrl.signal.addEventListener('abort', onAbort, { once: true });
      signal = merged.signal;
    }
  } else {
    signal = timeoutCtrl.signal;
  }

  return {
    init: { ...init, signal },
    clearTimer,
  };
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<Response> {
  const { init: timedInit, clearTimer } = withFetchTimeout(init, HEYDOCTOR_FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, timedInit);
  } finally {
    clearTimer();
  }
}

/** Un reintento solo ante fallo de red / timeout (no ante 4xx/5xx). */
function isRetriableNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  if (e instanceof DOMException && e.name === 'AbortError') return true;
  if (
    e !== null &&
    typeof e === 'object' &&
    'name' in e &&
    (e as { name: string }).name === 'AbortError'
  ) {
    return true;
  }
  return false;
}

async function fetchWithTimeoutOneNetworkRetry(
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetchWithTimeout(input, init);
  } catch (e) {
    if (!isRetriableNetworkError(e)) throw e;
    return await fetchWithTimeout(input, init);
  }
}

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
  const res = await fetchWithTimeout(`${base}/api/auth/refresh`, {
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

function initWithRetryMarker(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set(HEADER_HD_RETRIED, '1');
  return { ...init, headers };
}

function isAlreadyRetriedInit(init?: RequestInit): boolean {
  const h = new Headers(init?.headers);
  return h.get(HEADER_HD_RETRIED) === '1';
}

/**
 * `fetch` al API Nest con cookies + Bearer; si la respuesta es 401, intenta refresh
 * (deduplicado) y reintenta la misma petición una vez.
 */
export async function heydoctorFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (isAlreadyRetriedInit(init)) {
    return fetchWithTimeoutOneNetworkRetry(input, mergeHeydoctorInit(init));
  }
  const first = await fetchWithTimeoutOneNetworkRetry(
    input,
    mergeHeydoctorInit(init),
  );
  if (first.status !== 401) {
    return first;
  }
  const refreshed = await dedupedRefresh();
  if (!refreshed) {
    return first;
  }
  return fetchWithTimeoutOneNetworkRetry(
    input,
    mergeHeydoctorInit(initWithRetryMarker(init)),
  );
}

/** Respuesta de GET /api/admin/metrics/dashboard (rol admin). */
export type AdminBusinessDashboard = {
  asOf: string;
  consultationsCreated: number;
  consultationsCompleted: number;
  totalRevenue: number;
  currency: string;
  /** Porcentaje 0–100 */
  abandonmentRate: number;
  /** Pagos atribuibles / consultas creadas hoy (0–100). */
  conversionRate: number;
  /** Pacientes con 2+ consultas en ventana 30 días (UTC). */
  repeatUsers: number;
  /** Minutos promedio creación → cierre (consultas cerradas hoy). */
  avgConsultationTimeMinutes: number | null;
  /** Ingreso hoy / médicos con ingreso hoy. */
  revenuePerDoctor: number;
  funnel: {
    visits: number | null;
    visitsSource: string;
    created: number;
    paid: number;
    completed: number;
  };
  doctorPerformance: Array<{
    doctorId: string;
    displayName: string;
    consultationsWithRevenue: number;
    revenue: number;
  }>;
  byDay: Array<{
    date: string;
    consultations: number;
    revenue: number;
  }>;
};

/**
 * Métricas de negocio (consultas, ingresos, abandono). Requiere JWT admin.
 * Usa `heydoctorFetch` (cookies + Bearer + refresh ante 401).
 */
export async function fetchAdminBusinessDashboard(): Promise<AdminBusinessDashboard> {
  const base = requireHeydoctorApiBase();
  const res = await heydoctorFetch(`${base}/api/admin/metrics/dashboard`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `No se pudo cargar el dashboard (${res.status}): ${text.slice(0, 200)}`,
    );
  }
  return res.json() as Promise<AdminBusinessDashboard>;
}

/**
 * Punto de entrada único para llamadas al API Nest (extensible).
 */
export const heydoctorApi = {
  fetch: heydoctorFetch,
  admin: {
    getBusinessDashboard: fetchAdminBusinessDashboard,
  },
} as const;
