import { AsyncLocalStorage } from 'async_hooks';

export type RequestContextStore = {
  requestId: string;
  /** Optional correlation from `X-HeyDoctor-Consultation-Id` (UUID). */
  consultationId?: string;
  /** Optional per-call session id from `X-HeyDoctor-Call-Id` (UUID). */
  callId?: string;
};

const storage = new AsyncLocalStorage<RequestContextStore>();

/**
 * Binds correlation IDs for the current HTTP request (RequestIdMiddleware).
 * Uses `enterWith` so async handlers still see the store.
 */
export function enterRequestContext(ctx: RequestContextStore): void {
  storage.enterWith(ctx);
}

export function getRequestContext(): RequestContextStore | undefined {
  return storage.getStore();
}

/** Correlation ID for the active HTTP request, if any. */
export function getCurrentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

export function getContextConsultationId(): string | undefined {
  return storage.getStore()?.consultationId;
}

export function getContextCallId(): string | undefined {
  return storage.getStore()?.callId;
}
