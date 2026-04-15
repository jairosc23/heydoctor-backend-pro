import { createHash } from 'crypto';
import type { Cache } from 'cache-manager';
import type { Consultation } from '../../consultations/consultation.entity';
import type { Patient } from '../../patients/patient.entity';
import type { PaginatedResult } from '../types/paginated-result.type';

/** TTL de listados cacheados (pacientes / consultas por clínica). */
export const ENTITY_LIST_CACHE_TTL_MS = 60_000;

const VER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PAT_VER_PREFIX = 'hd:cache:patients:v:';
const CONS_VER_PREFIX = 'hd:cache:consultations:v:';

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
