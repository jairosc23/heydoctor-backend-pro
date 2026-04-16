/**
 * Ingesta de eventos al Nest (`POST /api/analytics/collect`).
 * Punto público: sin JWT obligatorio; opcional `sub` del Bearer si existe.
 */

import { apiCredentialsInit } from './api-credentials';
import { getHeydoctorApiBase, getStoredAccessToken } from './heydoctor-api';

const SESSION_STORAGE_KEY = 'heydoctor_analytics_session_id';

export type AnalyticsCollectEventName =
  | 'page_view'
  | 'consultation_started'
  | 'consultation_paid'
  | 'consultation_completed';

export type AnalyticsCollectEvent = {
  event: AnalyticsCollectEventName;
  path?: string;
  consultationId?: string;
  metadata?: Record<string, unknown>;
};

function randomUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getOrCreateAnalyticsSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && existing.length <= 64) return existing;
    const next = randomUuidV4().replace(/-/g, '').slice(0, 32);
    sessionStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return randomUuidV4().replace(/-/g, '').slice(0, 32);
  }
}

function optionalJwtSubUuid(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const token = getStoredAccessToken();
  if (!token) return undefined;
  const parts = token.split('.');
  if (parts.length < 2) return undefined;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const payload = JSON.parse(atob(b64 + pad)) as { sub?: unknown };
    if (typeof payload.sub !== 'string' || !UUID_RE.test(payload.sub)) return undefined;
    return payload.sub;
  } catch {
    return undefined;
  }
}

function optionalUuid(id: string): string | undefined {
  return UUID_RE.test(id.trim()) ? id.trim() : undefined;
}

async function postCollect(events: AnalyticsCollectEvent[]): Promise<void> {
  if (typeof window === 'undefined' || events.length === 0) return;
  const base = getHeydoctorApiBase();
  if (!base) return;

  const sessionId = getOrCreateAnalyticsSessionId();
  if (!sessionId) return;

  const userId = optionalJwtSubUuid();
  const body = JSON.stringify({
    sessionId,
    ...(userId ? { userId } : {}),
    events,
  });

  const url = `${base.replace(/\/$/, '')}/api/analytics/collect`;

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch {
    /* fall through */
  }

  try {
    await fetch(url, {
      method: 'POST',
      ...apiCredentialsInit,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body,
      keepalive: true,
    });
  } catch {
    /* no-op: analytics no debe romper UX */
  }
}

function currentPath(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.pathname}${window.location.search || ''}`.slice(0, 2048);
}

export function trackPageView(path?: string): Promise<void> {
  const p = path ?? currentPath();
  return postCollect([{ event: 'page_view', path: p }]);
}

export function trackConsultationStarted(
  consultationId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const cid = optionalUuid(consultationId);
  const meta = {
    ...(metadata ?? {}),
    ...(!cid ? { consultationRef: consultationId } : {}),
  };
  return postCollect([
    {
      event: 'consultation_started',
      path: currentPath(),
      ...(cid ? { consultationId: cid } : {}),
      ...(Object.keys(meta).length ? { metadata: meta } : {}),
    },
  ]);
}

export function trackConsultationPaid(
  consultationId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const cid = optionalUuid(consultationId);
  const meta = {
    ...(metadata ?? {}),
    ...(!cid ? { consultationRef: consultationId } : {}),
  };
  return postCollect([
    {
      event: 'consultation_paid',
      path: currentPath(),
      ...(cid ? { consultationId: cid } : {}),
      ...(Object.keys(meta).length ? { metadata: meta } : {}),
    },
  ]);
}

export function trackConsultationCompleted(
  consultationId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const cid = optionalUuid(consultationId);
  const meta = {
    ...(metadata ?? {}),
    ...(!cid ? { consultationRef: consultationId } : {}),
  };
  return postCollect([
    {
      event: 'consultation_completed',
      path: currentPath(),
      ...(cid ? { consultationId: cid } : {}),
      ...(Object.keys(meta).length ? { metadata: meta } : {}),
    },
  ]);
}
