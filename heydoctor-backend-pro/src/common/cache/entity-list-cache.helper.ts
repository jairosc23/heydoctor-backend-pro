import { createHash } from 'crypto';
import type { Cache } from 'cache-manager';
import type { Consultation } from '../../consultations/consultation.entity';
import type { Patient } from '../../patients/patient.entity';
import type { PaginatedResult } from '../types/paginated-result.type';

/** Tras este tiempo el valor sigue sirviéndose pero dispara revalidación en segundo plano. */
export const LIST_CACHE_FRESH_MS = 30_000;
/** TTL duro en almacén (Keyv); tras esto se recarga síncrono. */
export const LIST_CACHE_HARD_TTL_MS = 180_000;
/** Jitter máximo (ms) sumado al TTL duro al persistir, para no expirar todas las claves a la vez. */
export const LIST_CACHE_HARD_TTL_JITTER_MS = 5_000;

/**
 * TTL efectivo para `cache.set` de listas (hard + jitter 0–{@link LIST_CACHE_HARD_TTL_JITTER_MS}).
 */
export function entityListCacheHardStoreTtlMs(): number {
  return (
    LIST_CACHE_HARD_TTL_MS +
    Math.floor(Math.random() * (LIST_CACHE_HARD_TTL_JITTER_MS + 1))
  );
}

const VER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PAT_VER_PREFIX = 'hd:cache:patients:v:';
const CONS_VER_PREFIX = 'hd:cache:consultations:v:';

/** @deprecated usar envelope + HARD_TTL */
export const ENTITY_LIST_CACHE_TTL_MS = LIST_CACHE_HARD_TTL_MS;

export type EntityListCacheEnvelope<T> = {
  storedAt: number;
  payload: PaginatedResult<T>;
};

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((x) => stableStringify(x)).join(',')}]`;
  }
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  const parts = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`,
  );
  return `{${parts.join(',')}}`;
}

export function entityListCacheKey(
  prefix: 'pat' | 'cons',
  clinicId: string,
  version: number,
  query: unknown,
): string {
  const h = createHash('sha256')
    .update(stableStringify(query ?? {}))
    .digest('hex')
    .slice(0, 20);
  return `hd:cache:${prefix}:list:${clinicId}:v${version}:${h}`;
}

export async function getClinicListCacheVersion(
  cache: Cache,
  kind: 'patients' | 'consultations',
  clinicId: string,
): Promise<number> {
  const p = kind === 'patients' ? PAT_VER_PREFIX : CONS_VER_PREFIX;
  const v = await cache.get<number>(`${p}${clinicId}`);
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export async function bumpClinicListCacheVersion(
  cache: Cache,
  kind: 'patients' | 'consultations',
  clinicId: string,
): Promise<void> {
  const p = kind === 'patients' ? PAT_VER_PREFIX : CONS_VER_PREFIX;
  const k = `${p}${clinicId}`;
  const cur = (await cache.get<number>(k)) ?? 0;
  await cache.set(k, cur + 1, VER_TTL_MS);
}

function coerceDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

/** Keyv/JSON devuelve fechas como string; rehidratar para TypeORM-like shapes. */
export function revivePatientsListFromCache(
  row: PaginatedResult<Patient>,
): void {
  for (const p of row.data) {
    const d = coerceDate(p.createdAt as unknown);
    if (d) (p as { createdAt: Date }).createdAt = d;
  }
}

export function reviveConsultationsListFromCache(
  row: PaginatedResult<Consultation>,
): void {
  const rowMutable = row.data as unknown as Array<
    Consultation & Record<string, Date | undefined>
  >;
  for (const c of rowMutable) {
    for (const key of [
      'createdAt',
      'updatedAt',
      'signedAt',
      'consentGivenAt',
      'aiGeneratedAt',
    ] as const) {
      const d = coerceDate(c[key]);
      if (d) c[key] = d;
    }
    if (c.patient) {
      const pd = coerceDate(c.patient.createdAt as unknown);
      if (pd) (c.patient as { createdAt: Date }).createdAt = pd;
    }
  }
}

export function isCacheEnvelope<T>(
  raw: unknown,
): raw is EntityListCacheEnvelope<T> {
  return (
    raw !== null &&
    typeof raw === 'object' &&
    'storedAt' in raw &&
    'payload' in raw &&
    typeof (raw as EntityListCacheEnvelope<T>).storedAt === 'number' &&
    (raw as EntityListCacheEnvelope<T>).payload !== null &&
    typeof (raw as EntityListCacheEnvelope<T>).payload === 'object' &&
    Array.isArray((raw as EntityListCacheEnvelope<T>).payload.data)
  );
}
